import { EquipmentType } from "../schemas/equipment";
import { SensorReading } from "../schemas/sensor";
import { DataQualityFlag } from "../schemas/rules";
import { EQUIPMENT_SENSOR_LIMITS, getSensorLimit } from "./limits";
import { normalizeSensorReading } from "./units";

export interface DataQualityInput {
  equipmentType: EquipmentType;
  issueDescription?: string;
  recentEvents?: Array<{ description: string; occurredAt?: string }>;
  sensorReadings?: SensorReading[];
  /**
   * Reference time for evaluating stale timestamps (defaults to Date.now()).
   * Injectable for pure, deterministic test cases.
   */
  now?: Date | string | number;
}

const COLD_KEYWORDS_REGEX = /\b(?:frozen|freezing|ice|cold|chilled)\b/i;
const NO_VIBRATION_REGEX =
  /\b(?:no\s+vibration|smooth\s+running|minimal\s+vibration|zero\s+vibration|runs?\s+smoothly|no\s+shaking)\b/i;

/**
 * Pure function to evaluate data quality defects across sensor telemetry and issue descriptions.
 * Detects:
 * (a) MISSING data: no readings provided, or expected sensor keys missing for the equipment.
 * (b) OUT OF RANGE: values outside physical plausible limits, or unknown/unsupported units.
 * (c) CONFLICT: textual contradiction against readings, duplicate keys with differing values,
 *     or sensor timestamp preceding the reported event.
 * (d) STALE: sensor timestamps older than 24 hours.
 */
export function detectDataQuality(input: DataQualityInput): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const { equipmentType, issueDescription = "", recentEvents = [], sensorReadings, now } = input;
  const limits = EQUIPMENT_SENSOR_LIMITS[equipmentType] ?? [];

  // (a) MISSING DATA
  if (!sensorReadings || sensorReadings.length === 0) {
    flags.push({
      type: "missing",
      message: `No sensor telemetry provided for ${equipmentType}. Baseline operating conditions cannot be verified.`,
      relatedKeys: [],
    });
    return flags;
  }

  // Check for expected sensor keys missing
  const providedKeys = new Set(sensorReadings.map((r) => r.key));
  for (const limit of limits) {
    if (!providedKeys.has(limit.sensorKey)) {
      flags.push({
        type: "missing",
        message: `Expected sensor reading '${limit.sensorKey}' (${limit.name}) is missing for ${equipmentType}.`,
        relatedKeys: [limit.sensorKey],
      });
    }
  }

  // Group readings by key for duplicate and range checking
  const readingsByKey = new Map<string, SensorReading[]>();
  for (const r of sensorReadings) {
    const list = readingsByKey.get(r.key) ?? [];
    list.push(r);
    readingsByKey.set(r.key, list);
  }

  // (c.1) CONFLICT: Duplicate keys with differing values
  for (const [key, readings] of readingsByKey.entries()) {
    if (readings.length > 1) {
      const first = readings[0];
      const limit = getSensorLimit(equipmentType, key);
      const targetUnit = limit ? limit.unit : first.unit;

      const firstNorm = normalizeSensorReading(first.value, first.unit, targetUnit);

      for (let i = 1; i < readings.length; i++) {
        const next = readings[i];
        const nextNorm = normalizeSensorReading(next.value, next.unit, targetUnit);

        // Check if values differ meaningfully (> 0.01)
        if (Math.abs(firstNorm.value - nextNorm.value) > 0.01) {
          flags.push({
            type: "conflict",
            message: `Telemetry conflict: duplicate contradictory readings found for sensor '${key}' (${first.value} ${first.unit} vs ${next.value} ${next.unit}).`,
            relatedKeys: [key],
          });
          break; // Flag once per conflicting key
        }
      }
    }
  }

  // (b) OUT OF RANGE & UNKNOWN UNITS
  for (const reading of sensorReadings) {
    const limit = getSensorLimit(equipmentType, reading.key);
    if (!limit) {
      continue;
    }

    const norm = normalizeSensorReading(reading.value, reading.unit, limit.unit);

    if (norm.isUnknown) {
      flags.push({
        type: "out_of_range",
        message: `Sensor '${reading.key}' has unrecognized or incompatible unit '${reading.unit}' (expected '${limit.unit}'). Telemetry cannot be validated.`,
        relatedKeys: [reading.key],
      });
      continue;
    }

    if (norm.value < limit.plausibleMin || norm.value > limit.plausibleMax) {
      flags.push({
        type: "out_of_range",
        message: `Sensor '${reading.key}' value ${norm.value} ${limit.unit} is outside plausible physical range [${limit.plausibleMin}, ${limit.plausibleMax}] (suspected sensor fault or disconnected lead).`,
        relatedKeys: [reading.key],
      });
    }
  }

  // Combined narrative text for conflict detection
  const combinedText = [
    issueDescription,
    ...recentEvents.map((e) => e.description || ""),
  ].join(" ");

  // (c.2) CONFLICT: Description mentions cold/frozen while temperature is above warning
  const mentionsCold = COLD_KEYWORDS_REGEX.test(combinedText);
  if (mentionsCold) {
    for (const reading of sensorReadings) {
      const limit = getSensorLimit(equipmentType, reading.key);
      if (
        limit &&
        (limit.sensorKey.includes("temp") || limit.unit === "celsius") &&
        limit.warningHigh !== undefined
      ) {
        const norm = normalizeSensorReading(reading.value, reading.unit, limit.unit);
        if (!norm.isUnknown && norm.value >= limit.warningHigh) {
          flags.push({
            type: "conflict",
            message: `Telemetry conflict: issue description mentions cold/frozen operating condition, but ${limit.name} (${reading.key}) is elevated at ${norm.value} ${limit.unit} (warning threshold: ${limit.warningHigh} ${limit.unit}).`,
            relatedKeys: [reading.key],
          });
        }
      }
    }
  }

  // (c.3) CONFLICT: Description mentions no vibration while vibration is above warning
  const mentionsNoVibration = NO_VIBRATION_REGEX.test(combinedText);
  if (mentionsNoVibration) {
    for (const reading of sensorReadings) {
      const limit = getSensorLimit(equipmentType, reading.key);
      if (
        limit &&
        (limit.sensorKey.includes("vibration") || limit.unit === "mm/s") &&
        limit.warningHigh !== undefined
      ) {
        const norm = normalizeSensorReading(reading.value, reading.unit, limit.unit);
        if (!norm.isUnknown && norm.value >= limit.warningHigh) {
          flags.push({
            type: "conflict",
            message: `Telemetry conflict: issue description reports no vibration or smooth running, but ${limit.name} (${reading.key}) is elevated at ${norm.value} ${limit.unit} (warning threshold: ${limit.warningHigh} ${limit.unit}).`,
            relatedKeys: [reading.key],
          });
        }
      }
    }
  }

  // (c.4) CONFLICT: Sensor reading timestamp older than reported operating event
  for (const reading of sensorReadings) {
    if (!reading.recordedAt) continue;
    const readingTime = new Date(reading.recordedAt).getTime();
    if (isNaN(readingTime)) continue;

    for (const evt of recentEvents) {
      if (!evt.occurredAt) continue;
      const eventTime = new Date(evt.occurredAt).getTime();
      if (isNaN(eventTime)) continue;

      if (readingTime < eventTime) {
        flags.push({
          type: "conflict",
          message: `Telemetry conflict: sensor reading '${reading.key}' recorded at ${reading.recordedAt} is older than reported operating event at ${evt.occurredAt}. Telemetry does not reflect post-event condition.`,
          relatedKeys: [reading.key],
        });
        break; // Flag once per reading
      }
    }
  }

  // (d) STALE READINGS: Timestamps given and older than 24 hours
  const referenceTime = now ? new Date(now).getTime() : Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  for (const reading of sensorReadings) {
    if (!reading.recordedAt) continue;
    const readingTime = new Date(reading.recordedAt).getTime();
    if (isNaN(readingTime)) continue;

    const ageMs = referenceTime - readingTime;
    if (ageMs > TWENTY_FOUR_HOURS_MS) {
      const ageHours = Math.round(ageMs / (60 * 60 * 1000));
      flags.push({
        type: "stale",
        message: `Sensor reading '${reading.key}' is stale (${ageHours}h old, recorded at ${reading.recordedAt}). Timestamps exceeding 24 hours require re-measurement.`,
        relatedKeys: [reading.key],
      });
    }
  }

  return flags;
}
