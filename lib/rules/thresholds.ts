import { EquipmentType } from "../schemas/equipment";
import { SensorReading } from "../schemas/sensor";
import { RuleFinding } from "../schemas/rules";
import { getSensorLimit } from "./limits";
import { normalizeSensorReading } from "./units";

/**
 * Evaluates sensor readings against deterministic equipment limits.
 * Pure function with zero I/O.
 *
 * Rules:
 * - Warning -> priorityFloor 'medium' (or 'high' if isSafetyRelevant is true)
 * - Critical -> priorityFloor 'critical'
 * - Measured value, threshold, and canonical unit included in every finding.
 * - Normalises trivial units (e.g. °F to °C, bar to psi) prior to evaluation.
 * - Skips unknown units rather than guessing (data quality flags handle unknown units).
 */
export function evaluateThresholds(
  equipmentType: EquipmentType,
  readings?: SensorReading[]
): RuleFinding[] {
  if (!readings || readings.length === 0) {
    return [];
  }

  const findings: RuleFinding[] = [];

  for (const reading of readings) {
    const limit = getSensorLimit(equipmentType, reading.key);
    if (!limit) {
      continue;
    }

    const conversion = normalizeSensorReading(
      reading.value,
      reading.unit,
      limit.unit
    );

    // If unit is unknown or incompatible, do not guess
    if (conversion.isUnknown) {
      continue;
    }

    const val = conversion.value;

    // 1. Critical High
    if (limit.criticalHigh !== undefined && val >= limit.criticalHigh) {
      findings.push({
        ruleId: `${equipmentType}-${reading.key}-critical-high`,
        severity: "critical",
        sensorKey: reading.key,
        message: `${limit.name} (${reading.key}) reached CRITICAL high threshold: measured ${val} ${limit.unit} >= threshold ${limit.criticalHigh} ${limit.unit}.`,
        measured: val,
        threshold: limit.criticalHigh,
        unit: limit.unit,
        priorityFloor: "critical",
      });
    }
    // 2. Warning High (only if not critical high)
    else if (limit.warningHigh !== undefined && val >= limit.warningHigh) {
      findings.push({
        ruleId: `${equipmentType}-${reading.key}-warning-high`,
        severity: "warning",
        sensorKey: reading.key,
        message: `${limit.name} (${reading.key}) reached WARNING high threshold: measured ${val} ${limit.unit} >= threshold ${limit.warningHigh} ${limit.unit}.`,
        measured: val,
        threshold: limit.warningHigh,
        unit: limit.unit,
        priorityFloor: limit.isSafetyRelevant ? "high" : "medium",
      });
    }

    // 3. Critical Low
    if (limit.criticalLow !== undefined && val <= limit.criticalLow) {
      findings.push({
        ruleId: `${equipmentType}-${reading.key}-critical-low`,
        severity: "critical",
        sensorKey: reading.key,
        message: `${limit.name} (${reading.key}) reached CRITICAL low threshold: measured ${val} ${limit.unit} <= threshold ${limit.criticalLow} ${limit.unit}.`,
        measured: val,
        threshold: limit.criticalLow,
        unit: limit.unit,
        priorityFloor: "critical",
      });
    }
    // 4. Warning Low (only if not critical low)
    else if (limit.warningLow !== undefined && val <= limit.warningLow) {
      findings.push({
        ruleId: `${equipmentType}-${reading.key}-warning-low`,
        severity: "warning",
        sensorKey: reading.key,
        message: `${limit.name} (${reading.key}) reached WARNING low threshold: measured ${val} ${limit.unit} <= threshold ${limit.warningLow} ${limit.unit}.`,
        measured: val,
        threshold: limit.warningLow,
        unit: limit.unit,
        priorityFloor: limit.isSafetyRelevant ? "high" : "medium",
      });
    }
  }

  return findings;
}
