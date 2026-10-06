import { Db } from "mongodb";
import { getDb } from "./client";
import {
  getKbChunksCollection,
  getTriageRecordsCollection,
  getWorkOrdersCollection,
  getAuditEventsCollection,
  getEquipmentCollection,
} from "./collections";
import { DatabaseError } from "../schemas/errors";
import { ATLAS_VECTOR_DIMENSIONS } from "../rag/embeddings";

/**
 * Creates and verifies all necessary MongoDB indexes for the maintenance triage system.
 * - Text search index on kb_chunks (title, content, tags)
 * - Equipment type index on kb_chunks
 * - Equipment history index on triage_records (equipmentId + createdAt desc)
 * - Work order status index
 * - Audit trail index (entityId + timestamp desc)
 */
export async function ensureIndexes(db?: Db): Promise<void> {
  try {
    const database = db ?? (await getDb());

    const kbChunks = await getKbChunksCollection(database);
    const triageRecords = await getTriageRecordsCollection(database);
    const workOrders = await getWorkOrdersCollection(database);
    const auditEvents = await getAuditEventsCollection(database);
    const equipment = await getEquipmentCollection(database);

    await Promise.all([
      // 1. kb_chunks: text index on title, content, tags + equipmentType index + unique chunkId
      kbChunks.createIndex(
        { title: "text", content: "text", tags: "text" },
        { name: "kb_chunks_text_search" }
      ),
      kbChunks.createIndex(
        { equipmentType: 1 },
        { name: "kb_chunks_equipment_type" }
      ),
      kbChunks.createIndex(
        { chunkId: 1 },
        { unique: true, name: "kb_chunks_chunk_id_unique" }
      ),

      // 2. triage_records: equipment history compound index & unique id
      triageRecords.createIndex(
        { "issueReport.equipmentId": 1, createdAt: -1 },
        { name: "triage_records_equipment_created_idx" }
      ),
      triageRecords.createIndex(
        { id: 1 },
        { unique: true, name: "triage_records_id_unique" }
      ),

      // 3. work_orders: status index, unique id & triageRecordId
      workOrders.createIndex(
        { status: 1 },
        { name: "work_orders_status_idx" }
      ),
      workOrders.createIndex(
        { id: 1 },
        { unique: true, name: "work_orders_id_unique" }
      ),
      workOrders.createIndex(
        { triageRecordId: 1 },
        { name: "work_orders_triage_record_idx" }
      ),

      // 4. audit_events: entityId + timestamp desc (append-only audit log)
      auditEvents.createIndex(
        { entityId: 1, timestamp: -1 },
        { name: "audit_events_entity_time_idx" }
      ),

      // 5. equipment: unique equipmentId index
      equipment.createIndex(
        { equipmentId: 1 },
        { unique: true, name: "equipment_equipment_id_unique" }
      ),
    ]);

    const vectorIndexName = process.env.ATLAS_VECTOR_INDEX?.trim();
    if (vectorIndexName) {
      const existingVectorIndexes = await kbChunks
        .listSearchIndexes(vectorIndexName)
        .toArray();
      if (existingVectorIndexes.length === 0) {
        await kbChunks.createSearchIndex({
          name: vectorIndexName,
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: ATLAS_VECTOR_DIMENSIONS,
                similarity: "cosine",
              },
              { type: "filter", path: "equipmentType" },
            ],
          },
        });
      }
    }
  } catch (error) {
    throw new DatabaseError("Failed to initialize database indexes", {
      userMessage: "Database index initialization failed.",
      cause: error,
    });
  }
}
