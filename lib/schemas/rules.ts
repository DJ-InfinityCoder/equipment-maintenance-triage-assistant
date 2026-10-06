import { z } from "zod";
import { PriorityLevelSchema } from "./priority";

export const RuleSeveritySchema = z.enum(["info", "warning", "critical"]);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;

/**
 * Result of evaluating deterministic safety thresholds and domain rules.
 */
export const RuleFindingSchema = z.object({
  ruleId: z.string().trim().min(1, "Rule ID is required"),
  severity: RuleSeveritySchema,
  sensorKey: z.string().trim().optional(),
  message: z.string().trim().min(1, "Finding message cannot be empty"),
  measured: z.number().finite().optional(),
  threshold: z.number().finite().optional(),
  unit: z.string().trim().optional(),
  priorityFloor: PriorityLevelSchema,
});

export type RuleFinding = z.infer<typeof RuleFindingSchema>;

export const DataQualityFlagTypeSchema = z.enum([
  "missing",
  "conflict",
  "out_of_range",
  "stale",
]);

export type DataQualityFlagType = z.infer<typeof DataQualityFlagTypeSchema>;

/**
 * Flag raised when sensor data or event telemetry has quality defects.
 */
export const DataQualityFlagSchema = z.object({
  type: DataQualityFlagTypeSchema,
  message: z.string().trim().min(1, "Flag message cannot be empty"),
  relatedKeys: z.array(z.string().trim()),
});

export type DataQualityFlag = z.infer<typeof DataQualityFlagSchema>;
