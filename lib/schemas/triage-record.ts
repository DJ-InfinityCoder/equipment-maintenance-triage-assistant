import { z } from "zod";
import { IssueReportInputSchema } from "./issue-report";
import { RuleFindingSchema, DataQualityFlagSchema } from "./rules";
import { PriorityLevelSchema } from "./priority";
import { AiTriageOutputSchema } from "./ai-triage";
import { WorkOrderSchema, ConfirmedFindingSchema } from "./work-order";
import { AuditEventSchema } from "./audit";
import { AiErrorSubtypeSchema } from "./errors";
import { UserRoleSchema } from "./user";

export const FollowUpAnswerSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(2000),
  answeredBy: z.string().trim().min(1).max(200),
  answeredByRole: UserRoleSchema,
  answeredAt: z.string().datetime({ offset: true }),
});
export type FollowUpAnswer = z.infer<typeof FollowUpAnswerSchema>;

export const FollowUpAnswerSubmissionSchema = z
  .object({
    answers: z
      .array(
        z.object({
          questionIndex: z.number().int().nonnegative(),
          answer: z.string().trim().min(1).max(2000),
        })
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const indexes = data.answers.map((item) => item.questionIndex);
    if (new Set(indexes).size !== indexes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each follow-up question may only be answered once per submission.",
        path: ["answers"],
      });
    }
  });

export type FollowUpAnswerSubmissionInput = z.infer<
  typeof FollowUpAnswerSubmissionSchema
>;

/**
 * Metadata capturing retrieval execution status and referenced chunk IDs.
 */
export const RetrievalMetadataSchema = z.object({
  status: z.enum(["ok", "failed", "skipped"]),
  method: z.enum(["vector", "text", "keyword"]).optional(),
  chunkIds: z.array(z.string().trim()).default([]),
  warnings: z.array(z.string().trim()).default([]),
  error: z.string().optional(),
});
export type RetrievalMetadata = z.infer<typeof RetrievalMetadataSchema>;

/**
 * Metadata capturing AI generation execution status, output or failure subtype.
 */
export const AiMetadataSchema = z.object({
  status: z.enum(["ok", "failed", "skipped_no_context"]),
  output: AiTriageOutputSchema.nullable().optional(),
  error: z.string().optional(),
  errorSubtype: AiErrorSubtypeSchema.optional(),
  droppedSuggestions: z.array(z.unknown()).default([]),
});
export type AiMetadata = z.infer<typeof AiMetadataSchema>;

/**
 * Complete persisted triage record containing the issue report,
 * deterministic rule findings, knowledge base retrieval references,
 * AI triage proposal, final work order, technician findings, and audit trail.
 */
export const TriageRecordSchema = z.object({
  id: z.string().trim().min(1, "Record ID is required"),
  issueReport: IssueReportInputSchema,
  ruleFindings: z.array(RuleFindingSchema).default([]),
  ruleFloorPriority: PriorityLevelSchema,
  dataQualityFlags: z.array(DataQualityFlagSchema).default([]),
  retrievedChunkIds: z.array(z.string().trim()).default([]),
  retrieval: RetrievalMetadataSchema.optional(),
  aiTriage: AiTriageOutputSchema.nullable(),
  followUpAnswers: z.array(FollowUpAnswerSchema).default([]),
  ai: AiMetadataSchema.optional(),
  finalPriority: PriorityLevelSchema,
  finalSuggestedPriority: PriorityLevelSchema.optional(),
  workOrder: WorkOrderSchema,
  confirmedFindings: z.array(ConfirmedFindingSchema).default([]),
  auditTrail: z.array(AuditEventSchema).default([]),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type TriageRecord = z.infer<typeof TriageRecordSchema>;
