import { Db } from "mongodb";
import {
  getTriageRecordsCollection,
  getWorkOrdersCollection,
} from "../collections";
import {
  TriageRecord,
  EquipmentType,
  PriorityLevel,
  WorkOrderStatus,
} from "../../schemas";
import { DatabaseError } from "../../schemas/errors";
import { upsertEquipmentOnIssue } from "./equipment";
import { appendAuditEvent } from "./audit";
import { stripMongoId } from "./utils";

export interface ListTriageRecordsFilter {
  equipmentType?: EquipmentType;
  equipmentId?: string;
  reportedByUserId?: string;
  priority?: PriorityLevel;
  status?: WorkOrderStatus;
  search?: string;
}

export interface ListTriageRecordsResult {
  items: TriageRecord[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Creates and persists a complete TriageRecord, its associated draft work order,
 * updates equipment telemetry counters, and logs the initial audit trail.
 */
export async function createTriageRecord(
  record: TriageRecord,
  db?: Db
): Promise<TriageRecord> {
  try {
    const triageColl = await getTriageRecordsCollection(db);
    const workOrderColl = await getWorkOrdersCollection(db);

    // 1. Insert triage record
    await triageColl.insertOne(record);

    // 2. Also persist standalone draft work order for quick querying
    await workOrderColl.updateOne(
      { id: record.workOrder.id },
      { $set: record.workOrder },
      { upsert: true }
    );

    // 3. Update equipment issue count and latest issue timestamp
    await upsertEquipmentOnIssue(
      record.issueReport.equipmentId,
      record.issueReport.equipmentType,
      record.createdAt,
      db
    );

    // 4. Record initial audit event
    await appendAuditEvent(
      {
        entityId: record.id,
        type: "TRIAGE_RECORD_CREATED",
        actor: "system",
        timestamp: record.createdAt,
        after: {
          equipmentId: record.issueReport.equipmentId,
          finalPriority: record.finalPriority,
          ruleFloorPriority: record.ruleFloorPriority,
        },
        note: `Issue reported by ${record.issueReport.reportedBy} for ${record.issueReport.equipmentId}`,
      },
      db
    );

    return record;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError("Failed to persist triage record", {
      userMessage: "Triage record could not be saved.",
      cause: error,
    });
  }
}

/**
 * Retrieves a triage record by its unique ID.
 */
export async function getTriageRecord(
  id: string,
  db?: Db
): Promise<TriageRecord | null> {
  try {
    const coll = await getTriageRecordsCollection(db);
    const doc = await coll.findOne({ id });
    return doc ? (stripMongoId(doc) as unknown as TriageRecord) : null;
  } catch (error) {
    throw new DatabaseError(`Failed to retrieve triage record ${id}`, {
      userMessage: "Triage record retrieval failed.",
      cause: error,
    });
  }
}

/**
 * Lists triage records with filtering and pagination.
 */
export async function listTriageRecords(
  params?: {
    filter?: ListTriageRecordsFilter;
    pagination?: { page?: number; limit?: number };
  },
  db?: Db
): Promise<ListTriageRecordsResult> {
  try {
    const coll = await getTriageRecordsCollection(db);
    const page = Math.max(1, params?.pagination?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.pagination?.limit ?? 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (params?.filter?.equipmentType) {
      query["issueReport.equipmentType"] = params.filter.equipmentType;
    }
    if (params?.filter?.equipmentId) {
      query["issueReport.equipmentId"] = params.filter.equipmentId;
    }
    if (params?.filter?.reportedByUserId) {
      query["issueReport.reportedByUserId"] = params.filter.reportedByUserId;
    }
    if (params?.filter?.priority) {
      query.finalPriority = params.filter.priority;
    }
    if (params?.filter?.status) {
      query["workOrder.status"] = params.filter.status;
    }
    if (params?.filter?.search?.trim()) {
      const term = params.filter.search.trim();
      query.$or = [
        { "issueReport.equipmentId": { $regex: term, $options: "i" } },
        { "issueReport.issueDescription": { $regex: term, $options: "i" } },
        { "workOrder.title": { $regex: term, $options: "i" } },
      ];
    }

    const [docs, total] = await Promise.all([
      coll.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      coll.countDocuments(query),
    ]);

    return {
      items: docs.map((d) => stripMongoId(d) as unknown as TriageRecord),
      total,
      page,
      limit,
    };
  } catch (error) {
    throw new DatabaseError("Failed to list triage records", {
      userMessage: "Could not retrieve triage record list.",
      cause: error,
    });
  }
}

export interface DashboardSummaryStats {
  openDrafts: number;
  criticalOpen: number;
  failedAiRuns: number;
  approvedThisWeek: number;
}

/**
 * Computes dashboard summary KPI cards:
 * - open drafts
 * - critical open
 * - failed AI runs
 * - approved this week
 */
export async function getDashboardSummaryStats(
  db?: Db
): Promise<DashboardSummaryStats> {
  try {
    const coll = await getTriageRecordsCollection(db);
    const oneWeekAgo = new Date(
      Date.now() - 7 * 24 * 3600 * 1000
    ).toISOString();

    const [openDrafts, criticalOpen, failedAiRuns, approvedThisWeek] =
      await Promise.all([
        coll.countDocuments({ "workOrder.status": "draft" }),
        coll.countDocuments({
          "workOrder.status": "draft",
          finalPriority: "critical",
        }),
        coll.countDocuments({ "ai.status": "failed" }),
        coll.countDocuments({
          "workOrder.status": "approved",
          $or: [
            { "workOrder.decidedAt": { $gte: oneWeekAgo } },
            { updatedAt: { $gte: oneWeekAgo } },
          ],
        }),
      ]);

    return {
      openDrafts,
      criticalOpen,
      failedAiRuns,
      approvedThisWeek,
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError("Failed to fetch dashboard summary statistics", {
      userMessage: "Could not load dashboard statistics.",
      cause: error,
    });
  }
}
