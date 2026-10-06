import { getTriageRecordsCollection } from "@/lib/db/collections";
import { stripMongoId } from "@/lib/db/repos/utils";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { SessionUser } from "@/lib/auth/session";

export function canAccessTriageRecord(
  record: { issueReport: { reportedByUserId?: string } },
  session: Pick<SessionUser, "id" | "role">
): boolean {
  return (
    session.role === "technician" ||
    (typeof record.issueReport.reportedByUserId === "string" &&
      record.issueReport.reportedByUserId === session.id)
  );
}

export async function getAccessibleTriageRecord(
  triageId: string,
  session: SessionUser,
  workOrderId?: string
): Promise<TriageRecord | null> {
  const collection = await getTriageRecordsCollection();
  const document = await collection.findOne({ id: triageId });
  if (!document) return null;

  const record = stripMongoId(document) as unknown as TriageRecord;
  if (workOrderId && record.workOrder.id !== workOrderId) return null;
  if (!canAccessTriageRecord(record, session)) return null;
  return record;
}
