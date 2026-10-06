import { z } from "zod";
import { PriorityLevelSchema } from "./priority";

export const WorkOrderStatusSchema = z.enum(["draft", "approved", "rejected"]);
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusSchema>;

/**
 * Confirmed finding recorded strictly by a human technician.
 * Non-negotiable rule 3 & Rule 4: 'Confirmed findings' can only be entered by a human technician.
 * No route accepts confirmed findings from an AI source.
 */
export const ConfirmedFindingSchema = z.object({
  text: z.string().trim().min(1, "Finding text cannot be empty"),
  recordedBy: z
    .string()
    .trim()
    .min(1, "Recorded by identifier is required")
    .refine(
      (val) => {
        const lower = val.toLowerCase();
        return lower !== "ai" && lower !== "system" && lower !== "gemini";
      },
      { message: "Confirmed findings can only be recorded by a human technician, not AI." }
    ),
  recordedAt: z.string().datetime({ offset: true }),
  relatedCauseIndex: z
    .number()
    .int("Related cause index must be an integer")
    .nonnegative("Related cause index must be non-negative")
    .optional(),
});

export type ConfirmedFinding = z.infer<typeof ConfirmedFindingSchema>;

/**
 * Technician modifications to the AI draft work order before deciding.
 */
export const TechnicianEditsSchema = z.object({
  editedTitle: z.string().trim().min(1).optional(),
  editedDescription: z.string().trim().min(1).optional(),
  editedPriority: PriorityLevelSchema.optional(),
  customActions: z.array(z.string().trim().min(1)).optional(),
  customPartsToCheck: z.array(z.string().trim().min(1)).optional(),
  technicianNotes: z.string().trim().optional(),
});

export type TechnicianEdits = z.infer<typeof TechnicianEditsSchema>;

/**
 * Immutable snapshot of the AI draft work order at creation time.
 */
export const AiWorkOrderSnapshotSchema = z.object({
  title: z.string().trim(),
  description: z.string().trim(),
  finalPriority: PriorityLevelSchema,
  recommendedActions: z.array(z.string().trim()),
  partsToCheck: z.array(z.string().trim()),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

export type AiWorkOrderSnapshot = z.infer<typeof AiWorkOrderSnapshotSchema>;

/**
 * Work order generated from triage and acted upon by a technician.
 * Non-negotiable rule 2: The AI never approves work orders. Approval requires explicit technician action.
 */
export const WorkOrderSchema = z.object({
  id: z.string().trim().min(1, "Work order ID is required"),
  triageRecordId: z.string().trim().min(1, "Triage record ID is required"),
  status: WorkOrderStatusSchema,
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  finalPriority: PriorityLevelSchema,
  recommendedActions: z.array(z.string().trim()),
  partsToCheck: z.array(z.string().trim()),
  aiOriginal: AiWorkOrderSnapshotSchema.optional(),
  technicianEdits: TechnicianEditsSchema.optional(),
  confirmedFindings: z.array(ConfirmedFindingSchema).default([]),
  approvedBy: z.string().trim().optional(),
  decidedAt: z.string().datetime({ offset: true }).optional(),
  rejectionReason: z.string().trim().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type WorkOrder = z.infer<typeof WorkOrderSchema>;

/**
 * Zod validation schema for PATCH /api/work-orders/[id] edits.
 */
export const PatchWorkOrderSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").optional(),
  description: z.string().trim().min(1, "Description cannot be empty").optional(),
  finalPriority: PriorityLevelSchema.optional(),
  recommendedActions: z.array(z.string().trim()).optional(),
  partsToCheck: z.array(z.string().trim()).optional(),
  technicianEdits: TechnicianEditsSchema.optional(),
  confirmedFindings: z.array(ConfirmedFindingSchema).optional(),
  newFinding: ConfirmedFindingSchema.optional(),
  stepCompletion: z
    .object({
      stepNumber: z.number(),
      stepText: z.string().optional(),
      completed: z.boolean(),
    })
    .optional(),
  questionAnswer: z
    .object({
      questionIndex: z.number(),
      questionText: z.string().optional(),
      answer: z.string().trim(),
    })
    .optional(),
  technicianName: z.string().trim().optional(),
  actorRole: z.enum(["reporter", "technician"]).optional(),
  downgradeJustification: z.string().trim().optional(),
});

export type PatchWorkOrderInput = z.infer<typeof PatchWorkOrderSchema>;

/**
 * Zod validation schema for POST /api/work-orders/[id]/approve.
 */
export const ApproveWorkOrderSchema = z.object({
  technicianName: z
    .string()
    .trim()
    .min(1, "Technician name is required to authorize approval."),
  title: z.string().trim().min(1, "Work order title cannot be empty.").optional(),
  description: z.string().trim().min(1, "Work order description cannot be empty.").optional(),
  finalPriority: PriorityLevelSchema.optional(),
  recommendedActions: z.array(z.string().trim().min(1)).optional(),
  partsToCheck: z.array(z.string().trim().min(1)).optional(),
  justification: z.string().trim().optional(),
  technicianEdits: TechnicianEditsSchema.optional(),
  confirmedFindings: z.array(ConfirmedFindingSchema).optional(),
});

export type ApproveWorkOrderInput = z.infer<typeof ApproveWorkOrderSchema>;

/**
 * Zod validation schema for POST /api/work-orders/[id]/reject.
 */
export const RejectWorkOrderSchema = z.object({
  technicianName: z.string().trim().min(1, "Technician name is required."),
  actorRole: z.enum(["reporter", "technician"]).optional(),
  rejectionReason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required when rejecting a work order."),
  technicianEdits: TechnicianEditsSchema.optional(),
  confirmedFindings: z.array(ConfirmedFindingSchema).optional(),
});

export type RejectWorkOrderInput = z.infer<typeof RejectWorkOrderSchema>;
