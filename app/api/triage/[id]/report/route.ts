import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth/authorization";
import { checkRateLimit } from "@/lib/services/rateLimiter";
import { processTriageReport } from "@/lib/services/triageService";
import { getTriageRecordsCollection, getWorkOrdersCollection } from "@/lib/db/collections";
import { appendAuditEvent } from "@/lib/db/repos/audit";
import { stripMongoId } from "@/lib/db/repos/utils";
import { IssueReportInputSchema } from "@/lib/schemas/issue-report";
import { AppError, DatabaseError } from "@/lib/schemas/errors";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { logServerEvent } from "@/lib/services/logger";

export const maxDuration = 90;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  const rateLimit = checkRateLimit(
    `report-edit:${authorization.session.id}:${id}`,
    3,
    10 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many report edits. Please wait before editing again." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = IssueReportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report fields.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const triageCollection = await getTriageRecordsCollection();
    const workOrderCollection = await getWorkOrdersCollection();
    const existingDocument = await triageCollection.findOne({ id });
    if (!existingDocument) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    const existing = stripMongoId(existingDocument) as unknown as TriageRecord;
    if (
      authorization.session.role === "reporter" &&
      existing.issueReport.reportedByUserId !== authorization.session.id
    ) {
      return NextResponse.json({ error: "You can only edit reports you submitted." }, { status: 403 });
    }
    if (existing.workOrder.status !== "draft") {
      return NextResponse.json(
        { error: "This report is finalized and can no longer be edited." },
        { status: 409 }
      );
    }

    const updatedInput = {
      ...parsed.data,
      reportedBy: existing.issueReport.reportedBy,
      reportedByUserId: existing.issueReport.reportedByUserId,
      sensorReadings: (parsed.data.sensorReadings ?? []).filter(
        (reading) => reading.key.trim() && reading.unit.trim()
      ),
    };
    const processed = await processTriageReport(updatedInput, {
      saveRecordFn: async (record) => record,
    });
    const now = new Date().toISOString();
    const revisionEvent = {
      id: `audit_${crypto.randomUUID()}`,
      type: "report_corrected",
      actor: authorization.session.role,
      timestamp: now,
      before: existing.issueReport,
      after: updatedInput,
      note: `Report details corrected by ${authorization.session.role} ${authorization.session.name}; deterministic checks and triage were rerun.`,
    };
    const updatedWorkOrder = {
      ...processed.record.workOrder,
      id: existing.workOrder.id,
      triageRecordId: existing.id,
      createdAt: existing.workOrder.createdAt,
      updatedAt: now,
    };
    const updatedRecord: TriageRecord = {
      ...processed.record,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
      workOrder: updatedWorkOrder,
      followUpAnswers: [],
      auditTrail: [...existing.auditTrail, revisionEvent, ...processed.record.auditTrail],
    };

    const workOrderResult = await workOrderCollection.updateOne(
      { id: existing.workOrder.id, status: "draft" },
      { $set: updatedWorkOrder }
    );
    if (workOrderResult.matchedCount !== 1) {
      return NextResponse.json(
        { error: "The work order was finalized while you were editing." },
        { status: 409 }
      );
    }

    const updateResult = await triageCollection.updateOne(
      {
        id,
        ...(authorization.session.role === "reporter"
          ? { "issueReport.reportedByUserId": authorization.session.id }
          : {}),
        "workOrder.status": "draft",
      },
      {
        $set: {
          issueReport: updatedRecord.issueReport,
          ruleFindings: updatedRecord.ruleFindings,
          ruleFloorPriority: updatedRecord.ruleFloorPriority,
          dataQualityFlags: updatedRecord.dataQualityFlags,
          retrievedChunkIds: updatedRecord.retrievedChunkIds,
          retrieval: updatedRecord.retrieval,
          aiTriage: updatedRecord.aiTriage,
          followUpAnswers: [],
          ai: updatedRecord.ai,
          finalPriority: updatedRecord.finalPriority,
          finalSuggestedPriority: updatedRecord.finalSuggestedPriority,
          workOrder: updatedWorkOrder,
          auditTrail: updatedRecord.auditTrail,
          updatedAt: now,
        },
      }
    );
    if (updateResult.matchedCount !== 1) {
      return NextResponse.json(
        { error: "The report changed or was finalized while you were editing. Reload your report list." },
        { status: 409 }
      );
    }

    await appendAuditEvent({
      entityId: id,
      type: "REPORT_CORRECTED",
      actor: authorization.session.role,
      timestamp: now,
      before: { issueReport: existing.issueReport },
      after: {
        issueReport: updatedRecord.issueReport,
        ruleFloorPriority: updatedRecord.ruleFloorPriority,
      },
      note: `${authorization.session.role} ${authorization.session.name} corrected the report and reran triage.`,
    });

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode }
      );
    }
    const databaseError = error instanceof DatabaseError
      ? error
      : new DatabaseError("Failed to edit triage report", {
          userMessage: "The report could not be updated.",
          cause: error,
        });
    logServerEvent("error", "report_edit_failed", { triageId: id, code: databaseError.code });
    return NextResponse.json(
      { error: databaseError.userMessage, code: databaseError.code },
      { status: databaseError.statusCode }
    );
  }
}
