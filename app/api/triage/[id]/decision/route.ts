import { NextRequest, NextResponse } from "next/server";
import { saveWorkOrderDecision } from "@/lib/db/repos/work-orders";
import { getTriageRecordsCollection, getWorkOrdersCollection } from "@/lib/db/collections";
import { appendAuditEvent } from "@/lib/db/repos/audit";
import { stripMongoId } from "@/lib/db/repos/utils";
import { AppError, ValidationError } from "@/lib/schemas/errors";
import { TriageRecord, WorkOrder } from "@/lib/schemas";
import { ConfirmedFindingSchema, TechnicianEditsSchema } from "@/lib/schemas/work-order";
import { authorizeRequest } from "@/lib/auth/authorization";
import { z } from "zod";
import { getAccessibleTriageRecord } from "@/lib/auth/triage-access";
import { PRIORITY_RANK } from "@/lib/schemas/priority";

const DecisionPayloadSchema = z.object({
  action: z.enum(["approved", "rejected", "save_draft"]),
  decidedBy: z.string().optional(),
  rejectionReason: z.string().trim().max(2000).optional(),
  technicianEdits: TechnicianEditsSchema.optional(),
  confirmedFindings: z.array(ConfirmedFindingSchema).max(100).optional(),
  workOrderId: z.string().trim().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: triageId } = await context.params;
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  try {
    const parsed = DecisionPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid work order decision payload.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const {
      action,
      rejectionReason,
      technicianEdits,
      confirmedFindings,
      workOrderId,
    } = body;

    const triageColl = await getTriageRecordsCollection();
    const existingRecord = await triageColl.findOne({ id: triageId });

    if (!existingRecord) {
      return NextResponse.json(
        { error: `Triage record ${triageId} not found.` },
        { status: 404 }
      );
    }

    const accessibleRecord = await getAccessibleTriageRecord(
      triageId,
      authorization.session
    );
    if (!accessibleRecord) {
      return NextResponse.json({ error: "Triage record not found." }, { status: 404 });
    }
    const targetWorkOrderId = workOrderId || existingRecord.workOrder.id;
    if (targetWorkOrderId !== existingRecord.workOrder.id) {
      return NextResponse.json({ error: "Work order does not belong to this report." }, { status: 404 });
    }
    if (action === "approved" && authorization.session.role !== "technician") {
      return NextResponse.json({ error: "Only a technician can approve a work order." }, { status: 403 });
    }
    if (authorization.session.role === "reporter" && confirmedFindings !== undefined) {
      return NextResponse.json(
        { error: "Only a technician can add or edit confirmed findings." },
        { status: 403 }
      );
    }

    // 1. APPROVE or REJECT
    if (action === "approved" || action === "rejected") {
      const updatedWo = await saveWorkOrderDecision({
        workOrderId: targetWorkOrderId,
        status: action,
        decidedBy: authorization.session.name,
        actorRole: authorization.session.role,
        rejectionReason: action === "rejected" ? rejectionReason : undefined,
        technicianEdits,
        confirmedFindings: confirmedFindings?.map((finding) => ({
          ...finding,
          recordedBy: authorization.session.name,
        })),
      });

      const updatedRecordDoc = await triageColl.findOne({ id: triageId });
      return NextResponse.json({
        success: true,
        workOrder: updatedWo,
        record: stripMongoId(updatedRecordDoc!) as unknown as TriageRecord,
      });
    }

    // 2. SAVE DRAFT (Updates fields while keeping status as 'draft')
    if (action === "save_draft") {
      const now = new Date().toISOString();
      const workOrderColl = await getWorkOrdersCollection();

      const updateFields: Record<string, unknown> = {
        updatedAt: now,
      };

      if (technicianEdits) {
        if (
          authorization.session.role === "reporter" &&
          technicianEdits.editedPriority &&
          PRIORITY_RANK[technicianEdits.editedPriority] <
            PRIORITY_RANK[accessibleRecord.ruleFloorPriority]
        ) {
          return NextResponse.json(
            { error: `Reporter edits cannot lower priority below the safety rule floor '${accessibleRecord.ruleFloorPriority}'.` },
            { status: 400 }
          );
        }
        updateFields.technicianEdits = technicianEdits;
        if (technicianEdits.editedTitle) updateFields.title = technicianEdits.editedTitle;
        if (technicianEdits.editedDescription) updateFields.description = technicianEdits.editedDescription;
        if (technicianEdits.editedPriority) updateFields.finalPriority = technicianEdits.editedPriority;
        if (technicianEdits.customActions) updateFields.recommendedActions = technicianEdits.customActions;
        if (technicianEdits.customPartsToCheck) updateFields.partsToCheck = technicianEdits.customPartsToCheck;
      }

      if (confirmedFindings) {
        updateFields.confirmedFindings = confirmedFindings.map((finding) => ({
          ...finding,
          recordedBy: authorization.session.name,
        }));
      }

      const workOrderUpdate = await workOrderColl.updateOne(
        { id: targetWorkOrderId, status: "draft" },
        { $set: updateFields }
      );
      if (workOrderUpdate.matchedCount !== 1) {
        return NextResponse.json({ error: "Finalized work orders cannot be edited." }, { status: 409 });
      }

      const refreshedWo = await workOrderColl.findOne({ id: targetWorkOrderId });
      if (!refreshedWo) {
        return NextResponse.json({ error: "Work order not found." }, { status: 404 });
      }
      const plainWo = stripMongoId(refreshedWo) as unknown as WorkOrder;

      await triageColl.updateOne(
        { id: triageId },
        {
          $set: {
            workOrder: plainWo,
            confirmedFindings: confirmedFindings
              ? confirmedFindings.map((finding) => ({
                  ...finding,
                  recordedBy: authorization.session.name,
                }))
              : existingRecord.confirmedFindings,
            finalPriority: technicianEdits?.editedPriority || existingRecord.finalPriority,
            updatedAt: now,
          },
        }
      );

      await appendAuditEvent({
        entityId: targetWorkOrderId,
        type: "WORK_ORDER_DRAFT_UPDATED",
        actor: authorization.session.role,
        timestamp: now,
        note: `${authorization.session.role} ${authorization.session.name} updated draft work order fields`,
      });

      const updatedRecordDoc = await triageColl.findOne({ id: triageId });
      return NextResponse.json({
        success: true,
        workOrder: plainWo,
        record: stripMongoId(updatedRecordDoc!) as unknown as TriageRecord,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported actions: 'approved', 'rejected', 'save_draft'." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, userMessage: error.userMessage },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Failed to record decision.", details: String(error) },
      { status: 500 }
    );
  }
}
