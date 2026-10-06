import { Collection, Db, ObjectId } from "mongodb";
import { getDb } from "./client";
import {
  EquipmentType,
  IssueReportInput,
  RuleFinding,
  DataQualityFlag,
  AiTriageOutput,
  PriorityLevel,
  WorkOrder,
  WorkOrderStatus,
  ConfirmedFinding,
  TechnicianEdits,
  AuditEvent,
  AuditActor,
} from "../schemas";
import { UserRole } from "@/lib/schemas/user";

export interface KbChunkDoc {
  _id?: ObjectId;
  chunkId: string;
  equipmentType: EquipmentType;
  title: string;
  content: string;
  tags: string[];
  section?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TriageRecordDoc {
  _id?: ObjectId;
  id: string;
  issueReport: IssueReportInput;
  ruleFindings: RuleFinding[];
  ruleFloorPriority: PriorityLevel;
  dataQualityFlags: DataQualityFlag[];
  retrievedChunkIds: string[];
  aiTriage: AiTriageOutput | null;
  finalPriority: PriorityLevel;
  workOrder: WorkOrder;
  confirmedFindings: ConfirmedFinding[];
  auditTrail: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderDoc {
  _id?: ObjectId;
  id: string;
  triageRecordId: string;
  status: WorkOrderStatus;
  title: string;
  description: string;
  finalPriority: PriorityLevel;
  recommendedActions: string[];
  partsToCheck: string[];
  aiOriginal?: {
    title: string;
    description: string;
    finalPriority: PriorityLevel;
    recommendedActions: string[];
    partsToCheck: string[];
    createdAt?: string;
  };
  technicianEdits?: TechnicianEdits;
  confirmedFindings: ConfirmedFinding[];
  approvedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventDoc {
  _id?: ObjectId;
  id?: string;
  entityId: string; // References triageRecordId or workOrderId
  type: string;
  actor: AuditActor;
  timestamp: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

export interface EquipmentDoc {
  _id?: ObjectId;
  equipmentId: string;
  equipmentType: EquipmentType;
  lastIssueAt: string;
  issueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserDoc {
  _id?: ObjectId;
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
}

export const COLLECTION_NAMES = {
  KB_CHUNKS: "kb_chunks",
  TRIAGE_RECORDS: "triage_records",
  WORK_ORDERS: "work_orders",
  AUDIT_EVENTS: "audit_events",
  EQUIPMENT: "equipment",
  USERS: "users",
} as const;

export async function getKbChunksCollection(
  db?: Db
): Promise<Collection<KbChunkDoc>> {
  const database = db ?? (await getDb());
  return database.collection<KbChunkDoc>(COLLECTION_NAMES.KB_CHUNKS);
}

export async function getTriageRecordsCollection(
  db?: Db
): Promise<Collection<TriageRecordDoc>> {
  const database = db ?? (await getDb());
  return database.collection<TriageRecordDoc>(COLLECTION_NAMES.TRIAGE_RECORDS);
}

export async function getWorkOrdersCollection(
  db?: Db
): Promise<Collection<WorkOrderDoc>> {
  const database = db ?? (await getDb());
  return database.collection<WorkOrderDoc>(COLLECTION_NAMES.WORK_ORDERS);
}

export async function getAuditEventsCollection(
  db?: Db
): Promise<Collection<AuditEventDoc>> {
  const database = db ?? (await getDb());
  return database.collection<AuditEventDoc>(COLLECTION_NAMES.AUDIT_EVENTS);
}

export async function getEquipmentCollection(
  db?: Db
): Promise<Collection<EquipmentDoc>> {
  const database = db ?? (await getDb());
  return database.collection<EquipmentDoc>(COLLECTION_NAMES.EQUIPMENT);
}

export async function getUsersCollection(db?: Db): Promise<Collection<UserDoc>> {
  const database = db ?? (await getDb());
  return database.collection<UserDoc>(COLLECTION_NAMES.USERS);
}
