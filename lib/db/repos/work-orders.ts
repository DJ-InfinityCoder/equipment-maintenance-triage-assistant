import { Db } from "mongodb";
import {
  getWorkOrdersCollection,
  getTriageRecordsCollection,
} from "../collections";
import {
  WorkOrder,
  WorkOrderStatus,
  ConfirmedFinding,
  TechnicianEdits,
  PriorityLevel,
  PRIORITY_RANK,
  PatchWorkOrderInput,
  ApproveWorkOrderInput,
  RejectWorkOrderInput,
  AiWorkOrderSnapshot,
} from "../../schemas";
import {
  DatabaseError,
  ValidationError,
  ConflictError,
} from "../../schemas/errors";
import { appendAuditEvent } from "./audit";
import { stripMongoId } from "./utils";

export interface SaveWorkOrderDecisionParams {
  workOrderId: string;
  status: "approved" | "rejected";
  decidedBy: string;
  actorRole?: "reporter" | "technician";
  rejectionReason?: string;
  technicianEdits?: TechnicianEdits;
  confirmedFindings?: ConfirmedFinding[];
  note?: string;
}

export interface ListWorkOrdersFilter {
  status?: WorkOrderStatus;
  priority?: PriorityLevel;
}

export interface ListWorkOrdersResult {
  items: WorkOrder[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Ensures the immutable AI original snapshot is preserved or initialized from the existing draft.
 */
function resolveAiOriginalSnapshot(
  existingWo: {
    aiOriginal?: AiWorkOrderSnapshot;
    title: string;
    description: string;
    finalPriority: PriorityLevel;
    recommendedActions: string[];
    partsToCheck: string[];
    createdAt: string;
  },
  triageRecord?: {
    aiTriage?: {
      draftWorkOrder?: {
        title: string;
        description: string;
        recommendedActions: string[];
        partsToCheck: string[];
      };
      suggestedPriority?: PriorityLevel;
    } | null;
  } | null
): AiWorkOrderSnapshot {
  if (existingWo.aiOriginal) {
    return existingWo.aiOriginal;
  }
  return {
    title:
      triageRecord?.aiTriage?.draftWorkOrder?.title ?? existingWo.title,
    description:
      triageRecord?.aiTriage?.draftWorkOrder?.description ??
      existingWo.description,
    finalPriority:
      triageRecord?.aiTriage?.suggestedPriority ?? existingWo.finalPriority,
    recommendedActions: [
      ...(triageRecord?.aiTriage?.draftWorkOrder?.recommendedActions ??
        existingWo.recommendedActions ??
        []),
    ],
    partsToCheck: [
      ...(triageRecord?.aiTriage?.draftWorkOrder?.partsToCheck ??
        existingWo.partsToCheck ??
        []),
    ],
    createdAt: existingWo.createdAt,
  };
}

/**
 * Updates a draft work order (PATCH for edits).
 * Rule 2: Server-side state machine: draft -> approved or draft -> rejected only.
 *         Any attempt to change a decided work order returns 409.
 * Rule 3: For every edit, store the AI original next to the technician version.
 *         Append audit events for: field_edited (with before/after), priority_changed,
 *         question_answered, step_completed, finding_added.
 * Rule 4: Confirmed findings stored with author and timestamp. No route accepts findings from AI.
 */
export async function updateWorkOrder(
  workOrderId: string,
  patch: PatchWorkOrderInput,
  db?: Db
): Promise<WorkOrder> {
  const workOrderColl = await getWorkOrdersCollection(db);
  const triageColl = await getTriageRecordsCollection(db);

  const existingWo = await workOrderColl.findOne({ id: workOrderId });
  if (!existingWo) {
    throw new DatabaseError(`Work order ${workOrderId} not found.`, {
      statusCode: 404,
      userMessage: `Work order '${workOrderId}' does not exist.`,
    });
  }

  // Enforce Rule 2: Only 'draft' work orders can be edited. Decided work orders return 409 Conflict.
  if (existingWo.status !== "draft") {
    throw new ConflictError(
      `Work order '${workOrderId}' is already ${existingWo.status}. Modifying a decided work order is prohibited.`
    );
  }

  const triageRecord = await triageColl.findOne({
    id: existingWo.triageRecordId,
  });

  const now = new Date().toISOString();
  const actor = patch.actorRole ?? "technician";
  const actorName =
    patch.technicianName?.trim() || existingWo.approvedBy || actor;
  const actorLabel = actor === "technician" ? "Technician" : "Reporter";
  if (
    actor === "reporter" &&
    (patch.confirmedFindings !== undefined || patch.newFinding !== undefined)
  ) {
    throw new ValidationError(
      "Only a human technician can add or edit confirmed findings."
    );
  }

  // Ensure AI original snapshot is stored next to technician version
  const aiOriginal = resolveAiOriginalSnapshot(existingWo, triageRecord);

  const updateFields: Record<string, unknown> = {
    aiOriginal,
    updatedAt: now,
  };

  const auditEventsToLog: Array<{
    type: string;
    before?: unknown;
    after?: unknown;
    note?: string;
  }> = [];

  // 1. Field edits: Title
  const newTitle = patch.title ?? patch.technicianEdits?.editedTitle;
  if (newTitle !== undefined && newTitle !== existingWo.title) {
    updateFields.title = newTitle;
    auditEventsToLog.push({
      type: "field_edited",
      before: { field: "title", value: existingWo.title },
      after: { field: "title", value: newTitle },
      note: `${actorLabel} ${actorName} updated title`,
    });
  }

  // 2. Field edits: Description
  const newDescription =
    patch.description ?? patch.technicianEdits?.editedDescription;
  if (newDescription !== undefined && newDescription !== existingWo.description) {
    updateFields.description = newDescription;
    auditEventsToLog.push({
      type: "field_edited",
      before: { field: "description", value: existingWo.description },
      after: { field: "description", value: newDescription },
      note: `${actorLabel} ${actorName} updated description`,
    });
  }

  // 3. Field edits: Recommended Actions
  const newActions =
    patch.recommendedActions ?? patch.technicianEdits?.customActions;
  if (
    newActions !== undefined &&
    JSON.stringify(newActions) !== JSON.stringify(existingWo.recommendedActions)
  ) {
    updateFields.recommendedActions = newActions;
    auditEventsToLog.push({
      type: "field_edited",
      before: {
        field: "recommendedActions",
        value: existingWo.recommendedActions,
      },
      after: { field: "recommendedActions", value: newActions },
      note: `${actorLabel} ${actorName} updated recommended actions`,
    });
  }

  // 4. Field edits: Parts to check
  const newParts =
    patch.partsToCheck ?? patch.technicianEdits?.customPartsToCheck;
  if (
    newParts !== undefined &&
    JSON.stringify(newParts) !== JSON.stringify(existingWo.partsToCheck)
  ) {
    updateFields.partsToCheck = newParts;
    auditEventsToLog.push({
      type: "field_edited",
      before: { field: "partsToCheck", value: existingWo.partsToCheck },
      after: { field: "partsToCheck", value: newParts },
      note: `${actorLabel} ${actorName} updated parts to check`,
    });
  }

  // 5. Priority changed
  const newPriority =
    patch.finalPriority ?? patch.technicianEdits?.editedPriority;
  if (
    actor === "reporter" &&
    newPriority !== undefined &&
    triageRecord &&
    PRIORITY_RANK[newPriority] < PRIORITY_RANK[triageRecord.ruleFloorPriority]
  ) {
    throw new ValidationError(
      `Reporter edits cannot lower priority below the safety rule floor '${triageRecord.ruleFloorPriority}'.`
    );
  }
  if (newPriority !== undefined && newPriority !== existingWo.finalPriority) {
    updateFields.finalPriority = newPriority;
    auditEventsToLog.push({
      type: "priority_changed",
      before: { priority: existingWo.finalPriority },
      after: {
        priority: newPriority,
        justification: patch.downgradeJustification,
      },
      note: `${actorLabel} ${actorName} changed priority from ${existingWo.finalPriority} to ${newPriority}`,
    });
  }

  // 6. Technician Edits object
  if (patch.technicianEdits) {
    updateFields.technicianEdits = {
      ...(existingWo.technicianEdits || {}),
      ...patch.technicianEdits,
    };
  }

  // 7. Confirmed Findings (Rule 4: strictly from human technician)
  let updatedFindings = existingWo.confirmedFindings || [];

  if (patch.confirmedFindings) {
    for (const f of patch.confirmedFindings) {
      if (
        !f.recordedBy ||
        ["ai", "system", "gemini"].includes(f.recordedBy.toLowerCase())
      ) {
        throw new ValidationError(
          "Confirmed findings can only be recorded by a human technician, not AI."
        );
      }
    }
    updatedFindings = patch.confirmedFindings;
    updateFields.confirmedFindings = updatedFindings;
  }

  if (patch.newFinding) {
    if (
      !patch.newFinding.recordedBy ||
      ["ai", "system", "gemini"].includes(
        patch.newFinding.recordedBy.toLowerCase()
      )
    ) {
      throw new ValidationError(
        "Confirmed findings can only be recorded by a human technician, not AI."
      );
    }
    updatedFindings = [...updatedFindings, patch.newFinding];
    updateFields.confirmedFindings = updatedFindings;
    auditEventsToLog.push({
      type: "finding_added",
      after: { finding: patch.newFinding },
      note: `Technician ${patch.newFinding.recordedBy} added confirmed finding: ${patch.newFinding.text}`,
    });
  }

  // 8. Step completed audit event
  if (patch.stepCompletion) {
    auditEventsToLog.push({
      type: "step_completed",
      after: patch.stepCompletion,
      note: `${actorLabel} ${actorName} ${
        patch.stepCompletion.completed ? "completed" : "uncompleted"
      } step #${patch.stepCompletion.stepNumber}${
        patch.stepCompletion.stepText ? `: ${patch.stepCompletion.stepText}` : ""
      }`,
    });
  }

  // 9. Question answered audit event
  if (patch.questionAnswer) {
    auditEventsToLog.push({
      type: "question_answered",
      after: patch.questionAnswer,
      note: `${actorLabel} ${actorName} answered question #${patch.questionAnswer.questionIndex}: "${patch.questionAnswer.answer}"`,
    });
  }

  // Apply updates to work order collection
  const updatedWoDoc = await workOrderColl.findOneAndUpdate(
    { id: workOrderId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!updatedWoDoc) {
    throw new DatabaseError(`Failed to update work order ${workOrderId}.`);
  }

  const plainWo = stripMongoId(updatedWoDoc) as unknown as WorkOrder;

  // Persist audit events to audit_events collection and collect for triage record
  const createdAuditEvents = [];
  for (const item of auditEventsToLog) {
    const plainEvent = await appendAuditEvent(
      {
        entityId: workOrderId,
        type: item.type,
        actor,
        timestamp: now,
        before: item.before,
        after: item.after,
        note: item.note,
      },
      db
    );
    createdAuditEvents.push(plainEvent);
  }

  // Synchronize triage record: workOrder, confirmedFindings, auditTrail
  const triageUpdate: Record<string, unknown> = {
    workOrder: plainWo,
    confirmedFindings: updatedFindings,
    updatedAt: now,
  };
  if (updateFields.finalPriority) {
    triageUpdate.finalPriority = updateFields.finalPriority;
  }

  const triageMongoUpdate: Record<string, unknown> = {
    $set: triageUpdate,
  };
  if (createdAuditEvents.length > 0) {
    triageMongoUpdate.$push = {
      auditTrail: { $each: createdAuditEvents },
    };
  }

  await triageColl.updateOne(
    { id: plainWo.triageRecordId },
    triageMongoUpdate
  );

  return plainWo;
}

/**
 * Approves a work order (POST /approve).
 * Rule 1: Validate with Zod. Approving requires: technician name, non-empty title and description,
 *         and final priority >= rule floor OR a justification string.
 * Rule 2: Server-side state machine: draft -> approved or draft -> rejected only.
 *         Any attempt to change a decided work order returns 409.
 * Rule 3: Preserves AI original snapshot and appends 'approved' audit event.
 */
export async function approveWorkOrder(
  workOrderId: string,
  input: ApproveWorkOrderInput,
  db?: Db
): Promise<WorkOrder> {
  if (!input.technicianName?.trim()) {
    throw new ValidationError(
      "Technician name is required to authorize work order approval."
    );
  }

  const workOrderColl = await getWorkOrdersCollection(db);
  const triageColl = await getTriageRecordsCollection(db);

  const existingWo = await workOrderColl.findOne({ id: workOrderId });
  if (!existingWo) {
    throw new DatabaseError(`Work order ${workOrderId} not found.`, {
      statusCode: 404,
      userMessage: `Work order '${workOrderId}' does not exist.`,
    });
  }

  // Rule 2: State Machine check
  if (existingWo.status !== "draft") {
    throw new ConflictError(
      `Cannot approve work order: status is already '${existingWo.status}'. Only 'draft' work orders can be approved.`
    );
  }

  const triageRecord = await triageColl.findOne({
    id: existingWo.triageRecordId,
  });

  // Effective values
  const effectiveTitle = (
    input.title ??
    input.technicianEdits?.editedTitle ??
    existingWo.title
  ).trim();

  const effectiveDescription = (
    input.description ??
    input.technicianEdits?.editedDescription ??
    existingWo.description
  ).trim();

  const effectivePriority: PriorityLevel =
    input.finalPriority ??
    input.technicianEdits?.editedPriority ??
    existingWo.finalPriority;

  // Rule 1: Validation
  if (!input.technicianName?.trim()) {
    throw new ValidationError(
      "Technician name is required to authorize work order approval."
    );
  }
  if (!effectiveTitle) {
    throw new ValidationError("Work order title cannot be empty on approval.");
  }
  if (!effectiveDescription) {
    throw new ValidationError(
      "Work order description cannot be empty on approval."
    );
  }

  const ruleFloor = triageRecord?.ruleFloorPriority ?? "low";
  const priorityRank = PRIORITY_RANK[effectivePriority];
  const floorRank = PRIORITY_RANK[ruleFloor];

  const justification = (
    input.justification ??
    input.technicianEdits?.technicianNotes ??
    ""
  ).trim();

  if (priorityRank < floorRank && !justification) {
    throw new ValidationError(
      `Priority '${effectivePriority}' is below the safety rule floor '${ruleFloor}'. A justification string is required to approve with a downgraded priority.`
    );
  }

  // Rule 4: Verify confirmed findings
  const confirmedFindings =
    input.confirmedFindings ?? existingWo.confirmedFindings ?? [];
  for (const f of confirmedFindings) {
    if (
      !f.recordedBy ||
      ["ai", "system", "gemini"].includes(f.recordedBy.toLowerCase())
    ) {
      throw new ValidationError(
        "Confirmed findings cannot be recorded by an AI source."
      );
    }
  }

  const now = new Date().toISOString();
  const aiOriginal = resolveAiOriginalSnapshot(existingWo, triageRecord);

  const updateFields: Record<string, unknown> = {
    status: "approved",
    approvedBy: input.technicianName.trim(),
    decidedAt: now,
    title: effectiveTitle,
    description: effectiveDescription,
    finalPriority: effectivePriority,
    recommendedActions:
      input.recommendedActions ??
      input.technicianEdits?.customActions ??
      existingWo.recommendedActions,
    partsToCheck:
      input.partsToCheck ??
      input.technicianEdits?.customPartsToCheck ??
      existingWo.partsToCheck,
    aiOriginal,
    confirmedFindings,
    updatedAt: now,
  };

  if (input.technicianEdits) {
    updateFields.technicianEdits = {
      ...(existingWo.technicianEdits || {}),
      ...input.technicianEdits,
    };
  }

  const updatedResult = await workOrderColl.findOneAndUpdate(
    { id: workOrderId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!updatedResult) {
    throw new DatabaseError(`Failed to approve work order ${workOrderId}.`);
  }

  const plainWo = stripMongoId(updatedResult) as unknown as WorkOrder;

  // Append 'approved' audit event
  const approvalEvent = await appendAuditEvent(
    {
      entityId: workOrderId,
      type: "approved",
      actor: "technician",
      timestamp: now,
      before: {
        status: existingWo.status,
        finalPriority: existingWo.finalPriority,
      },
      after: {
        status: "approved",
        approvedBy: input.technicianName.trim(),
        finalPriority: effectivePriority,
        title: effectiveTitle,
        justification: justification || undefined,
      },
      note: `Work order officially approved and authorized by ${input.technicianName.trim()}`,
    },
    db
  );

  // Synchronize triage record
  await triageColl.updateOne(
    { id: plainWo.triageRecordId },
    {
      $set: {
        workOrder: plainWo,
        finalPriority: effectivePriority,
        confirmedFindings,
        updatedAt: now,
      },
      $push: {
        auditTrail: approvalEvent,
      },
    }
  );

  return plainWo;
}

/**
 * Rejects a work order (POST /reject).
 * Rule 2: Server-side state machine: draft -> approved or draft -> rejected only.
 *         Any attempt to change a decided work order returns 409.
 * Rule 3: Preserves AI original snapshot and appends 'rejected' audit event.
 */
export async function rejectWorkOrder(
  workOrderId: string,
  input: RejectWorkOrderInput,
  db?: Db
): Promise<WorkOrder> {
  if (!input.technicianName?.trim()) {
    throw new ValidationError("User name is required to reject a work order.");
  }
  if (input.actorRole === "reporter" && input.confirmedFindings !== undefined) {
    throw new ValidationError(
      "Only a human technician can add or edit confirmed findings."
    );
  }
  if (!input.rejectionReason?.trim()) {
    throw new ValidationError(
      "Rejection reason is required when rejecting a work order."
    );
  }

  const workOrderColl = await getWorkOrdersCollection(db);
  const triageColl = await getTriageRecordsCollection(db);

  const existingWo = await workOrderColl.findOne({ id: workOrderId });
  if (!existingWo) {
    throw new DatabaseError(`Work order ${workOrderId} not found.`, {
      statusCode: 404,
      userMessage: `Work order '${workOrderId}' does not exist.`,
    });
  }

  // Rule 2: State Machine check
  if (existingWo.status !== "draft") {
    throw new ConflictError(
      `Cannot reject work order: status is already '${existingWo.status}'. Only 'draft' work orders can be rejected.`
    );
  }

  const triageRecord = await triageColl.findOne({
    id: existingWo.triageRecordId,
  });

  const now = new Date().toISOString();
  const aiOriginal = resolveAiOriginalSnapshot(existingWo, triageRecord);

  const updateFields: Record<string, unknown> = {
    status: "rejected",
    rejectionReason: input.rejectionReason.trim(),
    decidedAt: now,
    aiOriginal,
    updatedAt: now,
  };

  if (input.confirmedFindings) {
    updateFields.confirmedFindings = input.confirmedFindings;
  }
  if (input.technicianEdits) {
    updateFields.technicianEdits = input.technicianEdits;
  }

  const updatedResult = await workOrderColl.findOneAndUpdate(
    { id: workOrderId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  if (!updatedResult) {
    throw new DatabaseError(`Failed to reject work order ${workOrderId}.`);
  }

  const plainWo = stripMongoId(updatedResult) as unknown as WorkOrder;

  // Append 'rejected' audit event
  const rejectionEvent = await appendAuditEvent(
    {
      entityId: workOrderId,
      type: "rejected",
      actor: input.actorRole ?? "technician",
      timestamp: now,
      before: { status: existingWo.status },
      after: {
        status: "rejected",
        decidedBy: input.technicianName.trim(),
        rejectionReason: input.rejectionReason.trim(),
      },
      note: `Work order rejected by ${input.actorRole === "reporter" ? "reporter" : "technician"} ${input.technicianName.trim()}: ${input.rejectionReason.trim()}`,
    },
    db
  );

  // Synchronize triage record
  await triageColl.updateOne(
    { id: plainWo.triageRecordId },
    {
      $set: {
        workOrder: plainWo,
        updatedAt: now,
      },
      $push: {
        auditTrail: rejectionEvent,
      },
    }
  );

  return plainWo;
}

/**
 * Saves a human technician's decision (approve or reject) for a draft work order.
 * Kept for backward compatibility.
 */
export async function saveWorkOrderDecision(
  params: SaveWorkOrderDecisionParams,
  db?: Db
): Promise<WorkOrder> {
  const { status, decidedBy, rejectionReason, technicianEdits, confirmedFindings } = params;

  if (status !== "approved" && status !== "rejected") {
    throw new ValidationError(
      `Invalid work order decision status '${status}'. Must be 'approved' or 'rejected'.`
    );
  }

  if (status === "rejected" && !rejectionReason?.trim()) {
    throw new ValidationError("Rejection reason is required when rejecting a work order.");
  }

  if (!decidedBy?.trim()) {
    throw new ValidationError("decidedBy identifier is required for technician decisions.");
  }

  if (status === "approved") {
    return approveWorkOrder(
      params.workOrderId,
      {
        technicianName: decidedBy,
        justification: technicianEdits?.technicianNotes,
        technicianEdits,
        confirmedFindings,
      },
      db
    );
  } else {
    return rejectWorkOrder(
      params.workOrderId,
      {
        technicianName: decidedBy,
        rejectionReason: rejectionReason!,
        technicianEdits,
        confirmedFindings,
        actorRole: params.actorRole,
      },
      db
    );
  }
}

/**
 * Retrieves a single work order by ID.
 */
export async function getWorkOrder(
  id: string,
  db?: Db
): Promise<WorkOrder | null> {
  try {
    const coll = await getWorkOrdersCollection(db);
    const doc = await coll.findOne({ id });
    return doc ? (stripMongoId(doc) as unknown as WorkOrder) : null;
  } catch (error) {
    throw new DatabaseError(`Failed to get work order ${id}`, {
      userMessage: "Work order retrieval failed.",
      cause: error,
    });
  }
}

/**
 * Lists work orders with filtering and pagination.
 */
export async function listWorkOrders(
  filter?: ListWorkOrdersFilter,
  pagination?: { page?: number; limit?: number },
  db?: Db
): Promise<ListWorkOrdersResult> {
  try {
    const coll = await getWorkOrdersCollection(db);
    const page = Math.max(1, pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination?.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.priority) query.finalPriority = filter.priority;

    const [docs, total] = await Promise.all([
      coll.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      coll.countDocuments(query),
    ]);

    return {
      items: docs.map((d) => stripMongoId(d) as unknown as WorkOrder),
      total,
      page,
      limit,
    };
  } catch (error) {
    throw new DatabaseError("Failed to list work orders", {
      userMessage: "Could not load work orders.",
      cause: error,
    });
  }
}
