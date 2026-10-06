import { Db } from "mongodb";
import { getAuditEventsCollection } from "../collections";
import { AuditActor } from "../../schemas";
import { DatabaseError } from "../../schemas/errors";

export interface CreateAuditEventInput {
  entityId: string;
  type: string;
  actor: AuditActor;
  timestamp?: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

export interface PlainAuditEvent {
  id: string;
  entityId: string;
  type: string;
  actor: AuditActor;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

/**
 * Appends an audit event to the immutable audit trail.
 * Strictly append-only: no update or delete functions are exposed.
 */
export async function appendAuditEvent(
  input: CreateAuditEventInput,
  db?: Db
): Promise<PlainAuditEvent> {
  try {
    const collection = await getAuditEventsCollection(db);
    const eventDoc = {
      entityId: input.entityId,
      type: input.type,
      actor: input.actor,
      timestamp: input.timestamp ?? new Date().toISOString(),
      before: input.before,
      after: input.after,
      note: input.note,
    };

    const result = await collection.insertOne(eventDoc);

    return {
      id: result.insertedId.toHexString(),
      entityId: eventDoc.entityId,
      type: eventDoc.type,
      actor: eventDoc.actor,
      timestamp: eventDoc.timestamp,
      before: eventDoc.before,
      after: eventDoc.after,
      note: eventDoc.note,
    };
  } catch (error) {
    throw new DatabaseError("Failed to record audit event", {
      userMessage: "Audit event could not be logged.",
      cause: error,
    });
  }
}

/**
 * Lists audit events chronologically for a given entity (triage record or work order).
 */
export async function listAuditEvents(
  entityId: string,
  options?: { limit?: number; offset?: number },
  db?: Db
): Promise<PlainAuditEvent[]> {
  try {
    const collection = await getAuditEventsCollection(db);
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const docs = await collection
      .find({ entityId })
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return docs.map((doc) => ({
      id: doc._id?.toHexString() ?? doc.id ?? "",
      entityId: doc.entityId,
      type: doc.type,
      actor: doc.actor,
      timestamp: doc.timestamp,
      before: doc.before,
      after: doc.after,
      note: doc.note,
    }));
  } catch (error) {
    throw new DatabaseError("Failed to list audit trail events", {
      userMessage: "Could not retrieve audit history.",
      cause: error,
    });
  }
}
