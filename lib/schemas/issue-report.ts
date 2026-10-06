import { z } from "zod";
import { EquipmentTypeSchema } from "./equipment";
import { SensorReadingSchema } from "./sensor";

/**
 * Operating event leading up to or surrounding the observed equipment issue.
 */
export const OperatingEventSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Event description cannot be empty")
    .max(1000, "Event description cannot exceed 1000 characters"),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export type OperatingEvent = z.infer<typeof OperatingEventSchema>;

/**
 * Payload submitted by the maintenance triage issue report form.
 */
export const IssueReportInputSchema = z.object({
  equipmentType: EquipmentTypeSchema,
  equipmentId: z
    .string()
    .trim()
    .min(1, "Equipment ID is required")
    .max(50, "Equipment ID cannot exceed 50 characters"),
  issueDescription: z
    .string()
    .trim()
    .min(10, "Issue description must be at least 10 characters")
    .max(2000, "Issue description cannot exceed 2000 characters"),
  recentEvents: z
    .array(OperatingEventSchema)
    .min(1, "At least one recent event entry is required (e.g. 'none reported')")
    .max(20, "No more than 20 recent events can be submitted"),
  sensorReadings: z
    .array(SensorReadingSchema)
    .max(50, "No more than 50 sensor readings can be submitted")
    .optional(),
  reportedBy: z.string().trim().min(1, "Reported by is required"),
  reportedByUserId: z.string().trim().min(1).optional(),
});

export type IssueReportInput = z.infer<typeof IssueReportInputSchema>;
