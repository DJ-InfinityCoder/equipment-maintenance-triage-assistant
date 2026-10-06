import { PriorityLevel, PRIORITY_RANK } from "../schemas/priority";
import { RuleFinding, DataQualityFlag } from "../schemas/rules";
import { EquipmentType } from "../schemas/equipment";
import { EQUIPMENT_SENSOR_LIMITS, getSensorLimit } from "./limits";

export interface PriorityFloorResult {
  priorityFloor: PriorityLevel;
  requiresVerification: boolean;
  reasons: string[];
}

export interface PriorityMergeResult {
  finalPriority: PriorityLevel;
  source: "rules" | "ai" | "both";
  explanation: string;
}

/**
 * Checks whether a given sensor key corresponds to a safety-relevant measurement.
 */
export function isSensorSafetyRelevant(
  key: string,
  equipmentType?: EquipmentType
): boolean {
  if (equipmentType) {
    const limit = getSensorLimit(equipmentType, key);
    if (limit !== undefined) {
      return limit.isSafetyRelevant ?? false;
    }
  }

  // If no equipment type given or not found in specified type, check across all equipment definitions
  for (const eq of Object.keys(EQUIPMENT_SENSOR_LIMITS) as EquipmentType[]) {
    const limit = getSensorLimit(eq, key);
    if (limit?.isSafetyRelevant) {
      return true;
    }
  }

  // Fallback heuristic for safety-critical physical terms
  return (
    key.includes("temp") ||
    key.includes("vibration") ||
    key.includes("pressure") ||
    key.includes("leak") ||
    key.includes("unbalance")
  );
}

/**
 * Computes the deterministic priority floor from rule findings and data quality flags.
 * Pure function with zero I/O.
 *
 * Rules:
 * - Highest floor among all rule findings is the baseline floor.
 * - Data conflicts NEVER lower priority.
 * - A data conflict on a safety-relevant sensor raises priority floor to at least 'medium'
 *   and sets requiresVerification = true.
 */
export function computePriorityFloor(
  findings: RuleFinding[] = [],
  flags: DataQualityFlag[] = [],
  equipmentType?: EquipmentType
): PriorityFloorResult {
  let highestFloor: PriorityLevel = "low";
  let requiresVerification = false;
  const reasons: string[] = [];

  // 1. Evaluate findings
  for (const finding of findings) {
    if (PRIORITY_RANK[finding.priorityFloor] > PRIORITY_RANK[highestFloor]) {
      highestFloor = finding.priorityFloor;
    }
    reasons.push(
      `Rule '${finding.ruleId}' (${finding.severity}): requires minimum '${finding.priorityFloor}' priority.`
    );
  }

  // 2. Evaluate data quality flags
  const conflictFlags = flags.filter((f) => f.type === "conflict");

  for (const flag of conflictFlags) {
    const hasSafetySensorConflict = flag.relatedKeys.some((k) =>
      isSensorSafetyRelevant(k, equipmentType)
    );

    // Any conflict requires technician verification
    requiresVerification = true;

    if (hasSafetySensorConflict) {
      reasons.push(
        `Safety-critical sensor conflict on [${flag.relatedKeys.join(
          ", "
        )}]: elevates priority floor to at least 'medium' and requires technician verification.`
      );

      // Floor must be at least 'medium', never lowered if already high/critical
      if (PRIORITY_RANK[highestFloor] < PRIORITY_RANK.medium) {
        highestFloor = "medium";
      }
    } else {
      reasons.push(
        `Telemetry conflict on [${flag.relatedKeys.join(
          ", "
        )}]: requires manual verification.`
      );
    }
  }

  return {
    priorityFloor: highestFloor,
    requiresVerification,
    reasons,
  };
}

/**
 * Merges deterministic rule floor priority with AI-suggested priority.
 * Non-negotiable rule 1: AI can never lower priority below the rule floor.
 *
 * Returns max of both, source ('rules' | 'ai' | 'both'), and explanation string.
 */
export function mergePriority(
  ruleFloor: PriorityLevel,
  aiSuggested: PriorityLevel
): PriorityMergeResult {
  const ruleRank = PRIORITY_RANK[ruleFloor];
  const aiRank = PRIORITY_RANK[aiSuggested];

  if (ruleRank > aiRank) {
    return {
      finalPriority: ruleFloor,
      source: "rules",
      explanation: `Deterministic safety rule floor '${ruleFloor}' overrides lower AI suggestion '${aiSuggested}'. Priority cannot be lowered below the safety floor.`,
    };
  }

  if (aiRank > ruleRank) {
    return {
      finalPriority: aiSuggested,
      source: "ai",
      explanation: `AI triage suggestion raised priority to '${aiSuggested}' (above rule floor '${ruleFloor}').`,
    };
  }

  return {
    finalPriority: ruleFloor,
    source: "both",
    explanation: `Deterministic safety rules and AI triage both agree on priority '${ruleFloor}'.`,
  };
}
