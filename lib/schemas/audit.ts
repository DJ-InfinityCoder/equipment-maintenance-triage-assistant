import { z } from "zod";

export const AuditActorSchema = z.enum(["system", "ai", "technician", "reporter"]);
export type AuditActor = z.infer<typeof AuditActorSchema>;

/**
 * Immutable audit trail event preserving state changes and human/machine interactions.
 */
export const AuditEventSchema = z.object({
  id: z.string().trim().optional(),
  type: z.string().trim().min(1, "Audit event type is required"),
  actor: AuditActorSchema,
  timestamp: z.string().datetime({ offset: true }),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  note: z.string().trim().optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
