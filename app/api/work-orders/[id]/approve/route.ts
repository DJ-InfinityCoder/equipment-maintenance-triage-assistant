import { NextRequest, NextResponse } from "next/server";
import { approveWorkOrder } from "@/lib/db/repos/work-orders";
import { ApproveWorkOrderSchema } from "@/lib/schemas/work-order";
import {
  ValidationError,
  ConflictError,
  DatabaseError,
} from "@/lib/schemas/errors";
import { getTriageRecordsCollection } from "@/lib/db/collections";
import { stripMongoId } from "@/lib/db/repos/utils";
import { TriageRecord } from "@/lib/schemas";
import { authorizeRequest } from "@/lib/auth/authorization";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/work-orders/[id]/approve
 * Authorizes and approves a work order.
 *
 * Rules enforced:
 * 1. Technician name, non-empty title and description, and finalPriority >= ruleFloor OR valid justification.
 * 2. State machine: only draft -> approved. Decided work orders return 409 Conflict.
 * 3. Preserves AI original snapshot and appends 'approved' audit event.
 * 4. Confirmed findings can only come from a technician, never AI.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const authorization = await authorizeRequest(request, ["technician"]);
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json();
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

    const approvedWo = await approveWorkOrder(id, {
      ...parseResult.data,
      technicianName: authorization.session.name,
    });

    const triageColl = await getTriageRecordsCollection();
    const updatedRecordDoc = await triageColl.findOne({
      id: approvedWo.triageRecordId,
    });

    return NextResponse.json({
      success: true,
      workOrder: approvedWo,
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
      { error: "Failed to approve work order.", details: message },
      { status: 500 }
    );
  }
}
