import { z } from "zod";

/**
 * Citation pointing to a knowledge-base document chunk.
 */
export const KbCitationSchema = z.object({
  type: z.literal("kb"),
  chunkId: z.string().trim().min(1, "Knowledge base chunk ID cannot be empty"),
  quote: z.string().trim().optional(),
});

export type KbCitation = z.infer<typeof KbCitationSchema>;

/**
 * Citation pointing to an item in recent operating events by index.
 */
export const EventCitationSchema = z.object({
  type: z.literal("event"),
  eventIndex: z
    .number()
    .int("Event index must be an integer")
    .nonnegative("Event index must be non-negative"),
});

export type EventCitation = z.infer<typeof EventCitationSchema>;

/**
 * Citation pointing to a specific sensor reading by its key.
 */
export const SensorCitationSchema = z.object({
  type: z.literal("sensor"),
  key: z.string().trim().min(1, "Sensor key cannot be empty"),
});

export type SensorCitation = z.infer<typeof SensorCitationSchema>;

/**
 * Discriminated union of all valid citation sources.
 * Non-negotiable rule 4: every AI suggestion must include verifiable citations.
 */
export const CitationSchema = z.discriminatedUnion("type", [
  KbCitationSchema,
  EventCitationSchema,
  SensorCitationSchema,
]);

export type Citation = z.infer<typeof CitationSchema>;
