import { NextRequest, NextResponse } from "next/server";
import {
  getWorkOrder,
  updateWorkOrder,
  approveWorkOrder,
  rejectWorkOrder,
} from "@/lib/db/repos/work-orders";
import {
  PatchWorkOrderSchema,
  ApproveWorkOrderSchema,
  RejectWorkOrderSchema,
} from "@/lib/schemas/work-order";
import {
  ValidationError,
  ConflictError,
  DatabaseError,
} from "@/lib/schemas/errors";
import { getTriageRecordsCollection } from "@/lib/db/collections";
import { stripMongoId } from "@/lib/db/repos/utils";
import { TriageRecord } from "@/lib/schemas";
import { authorizeRequest } from "@/lib/auth/authorization";
import { getAccessibleTriageRecord } from "@/lib/auth/triage-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/work-orders/[id]
 * Retrieves a work order by ID, along with its synchronized triage record.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;

  try {
    const workOrder = await getWorkOrder(id);
    if (!workOrder) {
      return NextResponse.json(
        { error: `Work order '${id}' not found.` },
        { status: 404 }
      );
    }

    const record = await getAccessibleTriageRecord(
      workOrder.triageRecordId,
      authorization.session,
      workOrder.id
    );
    if (!record) return NextResponse.json({ error: "Work order not found." }, { status: 404 });

    return NextResponse.json({
      success: true,
      workOrder,
      record,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to retrieve work order.", details: msg },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/work-orders/[id]
 * Edits draft work order fields and appends corresponding audit events:
 * - field_edited (with before/after)
 * - priority_changed (with before/after)
 * - question_answered
 * - step_completed
 * - finding_added
 *
 * Rule 2: Returns 409 Conflict if work order is already approved or rejected.
 * Rule 4: Confirmed findings cannot originate from AI.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parseResult = PatchWorkOrderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid work order edit payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const existingWorkOrder = await getWorkOrder(id);
    if (!existingWorkOrder) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    const accessibleRecord = await getAccessibleTriageRecord(
      existingWorkOrder.triageRecordId,
      authorization.session,
      existingWorkOrder.id
    );
    if (!accessibleRecord) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    if (
      authorization.session.role === "reporter" &&
      (parseResult.data.confirmedFindings !== undefined || parseResult.data.newFinding !== undefined)
    ) {
      return NextResponse.json(
        { error: "Only a technician can add or edit confirmed findings." },
        { status: 403 }
      );
    }

    const updatedWorkOrder = await updateWorkOrder(id, {
      ...parseResult.data,
      technicianName: authorization.session.name,
      actorRole: authorization.session.role,
      confirmedFindings: parseResult.data.confirmedFindings?.map((finding) => ({
        ...finding,
        recordedBy: authorization.session.name,
      })),
      newFinding: parseResult.data.newFinding
        ? { ...parseResult.data.newFinding, recordedBy: authorization.session.name }
        : undefined,
    });

    const triageColl = await getTriageRecordsCollection();
    const updatedRecordDoc = await triageColl.findOne({
      id: updatedWorkOrder.triageRecordId,
    });

    return NextResponse.json({
      success: true,
      workOrder: updatedWorkOrder,
      record: updatedRecordDoc
        ? (stripMongoId(updatedRecordDoc) as unknown as TriageRecord)
        : null,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: 400 }
      );
    }
    if (err instanceof DatabaseError && err.statusCode === 404) {
      return NextResponse.json(
        { error: err.userMessage || err.message },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to update work order.", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders/[id]
 * Fallback handler allowing POST directly with action: 'approve' | 'reject' | 'save_draft'.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid work order payload." }, { status: 400 });
    }
    const action = body.action || (body.status === "approved" ? "approve" : body.status === "rejected" ? "reject" : null);

    if (action === "approve" || action === "approved") {
      if (authorization.session.role !== "technician") {
        return NextResponse.json({ error: "Only a technician can approve a work order." }, { status: 403 });
      }
      const parseResult = ApproveWorkOrderSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: "Invalid work order approval payload.",
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        );
      }
      const wo = await approveWorkOrder(id, {
        ...parseResult.data,
        technicianName: authorization.session.name,
        confirmedFindings: parseResult.data.confirmedFindings?.map((finding) => ({
          ...finding,
          recordedBy: authorization.session.name,
        })),
      });
      const triageColl = await getTriageRecordsCollection();
      const rec = await triageColl.findOne({ id: wo.triageRecordId });
      return NextResponse.json({
        success: true,
        workOrder: wo,
        record: rec ? (stripMongoId(rec) as unknown as TriageRecord) : null,
      });
    }

    if (action === "reject" || action === "rejected") {
      const workOrder = await getWorkOrder(id);
      if (!workOrder || !(await getAccessibleTriageRecord(workOrder.triageRecordId, authorization.session, workOrder.id))) {
        return NextResponse.json({ error: "Work order not found." }, { status: 404 });
      }
      const parseResult = RejectWorkOrderSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: "Invalid work order rejection payload.",
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        );
      }
      if (authorization.session.role === "reporter" && parseResult.data.confirmedFindings) {
        return NextResponse.json(
          { error: "Only a technician can add or edit confirmed findings." },
          { status: 403 }
        );
      }
      const wo = await rejectWorkOrder(id, {
        ...parseResult.data,
        technicianName: authorization.session.name,
        actorRole: authorization.session.role,
        confirmedFindings: parseResult.data.confirmedFindings?.map((finding) => ({
          ...finding,
          recordedBy: authorization.session.name,
        })),
      });
      const triageColl = await getTriageRecordsCollection();
      const rec = await triageColl.findOne({ id: wo.triageRecordId });
      return NextResponse.json({
        success: true,
        workOrder: wo,
        record: rec ? (stripMongoId(rec) as unknown as TriageRecord) : null,
      });
    }

    // Default to patch / draft update
    const parseResult = PatchWorkOrderSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid work order payload.",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }
    const workOrder = await getWorkOrder(id);
    if (!workOrder || !(await getAccessibleTriageRecord(workOrder.triageRecordId, authorization.session, workOrder.id))) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    if (
      authorization.session.role === "reporter" &&
      (parseResult.data.confirmedFindings !== undefined || parseResult.data.newFinding !== undefined)
    ) {
      return NextResponse.json(
        { error: "Only a technician can add or edit confirmed findings." },
        { status: 403 }
      );
    }
    const wo = await updateWorkOrder(id, {
      ...parseResult.data,
      technicianName: authorization.session.name,
      actorRole: authorization.session.role,
      confirmedFindings: parseResult.data.confirmedFindings?.map((finding) => ({
        ...finding,
        recordedBy: authorization.session.name,
      })),
      newFinding: parseResult.data.newFinding
        ? { ...parseResult.data.newFinding, recordedBy: authorization.session.name }
        : undefined,
    });
    const triageColl = await getTriageRecordsCollection();
    const rec = await triageColl.findOne({ id: wo.triageRecordId });
    return NextResponse.json({
      success: true,
      workOrder: wo,
      record: rec ? (stripMongoId(rec) as unknown as TriageRecord) : null,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: 400 }
      );
    }
    if (err instanceof DatabaseError && err.statusCode === 404) {
      return NextResponse.json(
        { error: err.userMessage || err.message },
        { status: 404 }
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to process work order decision.", details: message },
      { status: 500 }
    );
  }
}
