import { Db } from "mongodb";
import {
  getEquipmentCollection,
  getTriageRecordsCollection,
  getWorkOrdersCollection,
  EquipmentDoc,
} from "../collections";
import { EquipmentType, TriageRecord, WorkOrder, ConfirmedFinding } from "../../schemas";
import { DatabaseError } from "../../schemas/errors";
import { stripMongoId } from "./utils";

export interface RecurrenceInsight {
  hasRecurrence: boolean;
  keyword?: string;
  count: number;
  days: number;
  message: string;
  matchingFindings: ConfirmedFinding[];
}

export interface EquipmentHistoryResult {
  equipment: Omit<EquipmentDoc, "_id"> | null;
  recentTriageRecords: TriageRecord[];
  recentWorkOrders: WorkOrder[];
  recurrenceInsight: RecurrenceInsight;
}

/**
 * Upserts equipment record and increments its issue counter whenever an issue is reported.
 */
export async function upsertEquipmentOnIssue(
  equipmentId: string,
  equipmentType: EquipmentType,
  issueDate?: string,
  db?: Db
): Promise<Omit<EquipmentDoc, "_id">> {
  try {
    const collection = await getEquipmentCollection(db);
    const now = issueDate ?? new Date().toISOString();

    const result = await collection.findOneAndUpdate(
      { equipmentId },
      {
        $set: {
          equipmentType,
          lastIssueAt: now,
          updatedAt: now,
        },
        $inc: { issueCount: 1 },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (!result) {
      throw new DatabaseError(`Failed to update equipment document for ${equipmentId}`, {
        userMessage: "Could not update equipment registry.",
      });
    }

    return stripMongoId(result)!;
  } catch (error) {
    if (error instanceof DatabaseError) throw error;
    throw new DatabaseError(`Error upserting equipment record for ${equipmentId}`, {
      userMessage: "Failed to record equipment event.",
      cause: error,
    });
  }
}

/**
 * Computes recurrence indicator strictly from past human confirmed findings (NOT AI hypotheses).
 * e.g., 'Seal-related fault reported 3 times in 90 days'
 */
export function computeRecurrenceIndicator(
  records: TriageRecord[],
  days: number = 90
): RecurrenceInsight {
  const cutoffTime = new Date(Date.now() - days * 24 * 3600 * 1000).getTime();

  // Extract past confirmed findings ONLY (Non-negotiable: human confirmed findings, not AI hypotheses)
  const findings: ConfirmedFinding[] = [];
  for (const record of records) {
    const recordTime = new Date(record.createdAt).getTime();
    if (recordTime >= cutoffTime) {
      if (record.confirmedFindings && record.confirmedFindings.length > 0) {
        findings.push(...record.confirmedFindings);
      }
    }
  }

  // Predefined equipment cause keywords
  const CAUSE_KEYWORDS = [
    "seal",
    "bearing",
    "vibration",
    "leak",
    "leakage",
    "overheat",
    "temperature",
    "cavitation",
    "impeller",
    "pressure",
    "lubrication",
    "oil",
    "alignment",
    "coupling",
    "valve",
    "gasket",
    "motor",
    "flow",
    "clog",
    "shaft",
  ];

  const keywordBuckets: Record<string, ConfirmedFinding[]> = {};

  for (const f of findings) {
    const textLower = f.text.toLowerCase();
    for (const kw of CAUSE_KEYWORDS) {
      if (textLower.includes(kw)) {
        if (!keywordBuckets[kw]) {
          keywordBuckets[kw] = [];
        }
        keywordBuckets[kw].push(f);
      }
    }
  }

  let topKeyword: string | null = null;
  let maxCount = 0;

  for (const [kw, matching] of Object.entries(keywordBuckets)) {
    if (matching.length > maxCount && matching.length >= 2) {
      maxCount = matching.length;
      topKeyword = kw;
    }
  }

  if (topKeyword && maxCount >= 2) {
    const capitalized =
      topKeyword.charAt(0).toUpperCase() + topKeyword.slice(1);
    return {
      hasRecurrence: true,
      keyword: topKeyword,
      count: maxCount,
      days,
      message: `${capitalized}-related fault reported ${maxCount} times in ${days} days across confirmed findings`,
      matchingFindings: keywordBuckets[topKeyword],
    };
  }

  return {
    hasRecurrence: false,
    count: 0,
    days,
    message: `No recurring faults detected across confirmed findings in ${days} days.`,
    matchingFindings: [],
  };
}

/**
 * Retrieves aggregate equipment history, past triage records, associated work orders,
 * and computed recurrence insight from confirmed findings.
 */
export async function getEquipmentHistory(
  equipmentId: string,
  options?: { limit?: number },
  db?: Db
): Promise<EquipmentHistoryResult> {
  try {
    const limit = options?.limit ?? 50;
    const equipColl = await getEquipmentCollection(db);
    const triageColl = await getTriageRecordsCollection(db);
    const workOrderColl = await getWorkOrdersCollection(db);

    const [equipmentDoc, triageDocs] = await Promise.all([
      equipColl.findOne({ equipmentId }),
      triageColl
        .find({ "issueReport.equipmentId": equipmentId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray(),
    ]);

    const triageIds = triageDocs.map((d) => d.id);
    const workOrderDocs =
      triageIds.length > 0
        ? await workOrderColl
            .find({ triageRecordId: { $in: triageIds } })
            .sort({ createdAt: -1 })
            .toArray()
        : [];

    const recentTriageRecords = triageDocs.map(
      (d) => stripMongoId(d) as unknown as TriageRecord
    );
    const recurrenceInsight = computeRecurrenceIndicator(recentTriageRecords, 90);

    return {
      equipment: stripMongoId(equipmentDoc),
      recentTriageRecords,
      recentWorkOrders: workOrderDocs.map(
        (w) => stripMongoId(w) as unknown as WorkOrder
      ),
      recurrenceInsight,
    };
  } catch (error) {
    throw new DatabaseError(`Failed to retrieve history for equipment ${equipmentId}`, {
      userMessage: "Equipment history could not be loaded.",
      cause: error,
    });
  }
}
