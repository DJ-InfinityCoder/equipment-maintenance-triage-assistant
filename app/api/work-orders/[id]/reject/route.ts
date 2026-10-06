import { NextRequest, NextResponse } from "next/server";
import { rejectWorkOrder } from "@/lib/db/repos/work-orders";
import { RejectWorkOrderSchema } from "@/lib/schemas/work-order";
import {
  ValidationError,
  ConflictError,
  DatabaseError,
} from "@/lib/schemas/errors";
import { getTriageRecordsCollection } from "@/lib/db/collections";
import { stripMongoId } from "@/lib/db/repos/utils";
import { TriageRecord } from "@/lib/schemas";
import { authorizeRequest } from "@/lib/auth/authorization";
import { getWorkOrder } from "@/lib/db/repos/work-orders";
import { getAccessibleTriageRecord } from "@/lib/auth/triage-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/work-orders/[id]/reject
 * Rejects a draft work order.
 *
 * Rules enforced:
 * 1. Requires technician name and non-empty rejection reason.
 * 2. State machine: only draft -> rejected. Decided work orders return 409 Conflict.
 * 3. Preserves AI original snapshot and appends 'rejected' audit event.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
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

    const workOrder = await getWorkOrder(id);
    if (!workOrder || !(await getAccessibleTriageRecord(workOrder.triageRecordId, authorization.session, workOrder.id))) {
      return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    }
    if (authorization.session.role === "reporter" && parseResult.data.confirmedFindings) {
      return NextResponse.json(
        { error: "Only a technician can add or edit confirmed findings." },
        { status: 403 }
      );
    }

    const rejectedWo = await rejectWorkOrder(id, {
      ...parseResult.data,
      technicianName: authorization.session.name,
      actorRole: authorization.session.role,
    });

    const triageColl = await getTriageRecordsCollection();
    const updatedRecordDoc = await triageColl.findOne({
      id: rejectedWo.triageRecordId,
    });

    return NextResponse.json({
      success: true,
      workOrder: rejectedWo,
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
      { error: "Failed to reject work order.", details: message },
      { status: 500 }
    );
  }
}
