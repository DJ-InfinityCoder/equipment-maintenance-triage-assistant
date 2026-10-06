import { z } from "zod";

/**
 * Standard priority levels across rules, AI triage suggestions, and work orders.
 */
export const PRIORITY_LEVELS = ["low", "medium", "high", "critical"] as const;

export const PriorityLevelSchema = z.enum(PRIORITY_LEVELS);

export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;

/**
 * Numeric rank for deterministic priority floor comparisons.
 * low (1) < medium (2) < high (3) < critical (4)
 */
export const PRIORITY_RANK: Record<PriorityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Deterministically computes max(ruleFloor, aiSuggestedPriority).
 * Enforces Non-Negotiable Rule 1: AI can never lower priority below the rule floor.
 */
export function computeFinalPriority(
  ruleFloor: PriorityLevel,
  aiSuggested: PriorityLevel
): PriorityLevel {
  return PRIORITY_RANK[aiSuggested] >= PRIORITY_RANK[ruleFloor]
    ? aiSuggested
    : ruleFloor;
}
