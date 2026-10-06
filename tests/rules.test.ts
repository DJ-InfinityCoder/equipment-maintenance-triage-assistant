import { describe, it, expect } from "vitest";
import {
  EQUIPMENT_SENSOR_LIMITS,
  getSensorLimit,
  normalizeSensorReading,
  normalizeUnitString,
  evaluateThresholds,
  evaluateKeywordRules,
  detectDataQuality,
  computePriorityFloor,
  mergePriority,
  isSensorSafetyRelevant,
} from "../lib/rules";
import { PRIORITY_RANK, PriorityLevel } from "../lib/schemas/priority";
import { RuleFinding, DataQualityFlag } from "../lib/schemas/rules";

describe("lib/rules - Pure Deterministic Engine", () => {
  // =========================================================================
  // 1. LIMITS DEFINITIONS
  // =========================================================================
  describe("EQUIPMENT_SENSOR_LIMITS", () => {
    it("defines limits for all 5 equipment types", () => {
      const types = [
        "centrifugal_pump",
        "air_compressor",
        "hvac_chiller",
        "electric_motor",
        "conveyor",
      ] as const;

      for (const eq of types) {
        const limits = EQUIPMENT_SENSOR_LIMITS[eq];
        expect(limits).toBeDefined();
        expect(limits.length).toBeGreaterThanOrEqual(5);

        for (const limit of limits) {
          expect(limit.sensorKey).toBeTruthy();
          expect(limit.unit).toBeTruthy();
          expect(limit.plausibleMin).toBeLessThan(limit.plausibleMax);
          if (limit.warningHigh !== undefined && limit.criticalHigh !== undefined) {
            expect(limit.warningHigh).toBeLessThanOrEqual(limit.criticalHigh);
          }
          if (limit.warningLow !== undefined && limit.criticalLow !== undefined) {
            expect(limit.criticalLow).toBeLessThanOrEqual(limit.warningLow);
          }
        }
      }
    });

    it("retrieves sensor limits by key using getSensorLimit", () => {
      const limit = getSensorLimit("centrifugal_pump", "bearing_temp_c");
      expect(limit).toBeDefined();
      expect(limit?.unit).toBe("celsius");
      expect(limit?.warningHigh).toBe(75);
      expect(limit?.criticalHigh).toBe(85);
      expect(limit?.isSafetyRelevant).toBe(true);

      const missing = getSensorLimit("centrifugal_pump", "non_existent_key");
      expect(missing).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. UNIT CONVERSIONS & NORMALIZATION
  // =========================================================================
  describe("normalizeSensorReading & normalizeUnitString", () => {
    it("normalizes unit strings properly", () => {
      expect(normalizeUnitString(" °C ")).toBe("c");
      expect(normalizeUnitString("deg F")).toBe("degf");
      expect(normalizeUnitString("MM / S")).toBe("mm/s");
    });

    it("handles identical units without conversion", () => {
      const res = normalizeSensorReading(65, "celsius", "celsius");
      expect(res.value).toBe(65);
      expect(res.isConverted).toBe(false);
      expect(res.isUnknown).toBe(false);
    });

    describe("Temperature conversions", () => {
      it("converts Fahrenheit to Celsius correctly", () => {
        // 32°F = 0°C
        const resFreezing = normalizeSensorReading(32, "fahrenheit", "celsius");
        expect(resFreezing.value).toBe(0);
        expect(resFreezing.unit).toBe("celsius");
        expect(resFreezing.isConverted).toBe(true);

        // 212°F = 100°C
        const resBoiling = normalizeSensorReading(212, "degF", "celsius");
        expect(resBoiling.value).toBe(100);

        // 167°F = 75°C
        const resWarning = normalizeSensorReading(167, "F", "celsius");
        expect(resWarning.value).toBe(75);
      });

      it("converts Kelvin to Celsius correctly", () => {
        // 373.15 K = 100°C
        const res = normalizeSensorReading(373.15, "K", "celsius");
        expect(res.value).toBe(100);
        expect(res.isConverted).toBe(true);
      });

      it("flags unknown unit for temperature sensor", () => {
        const res = normalizeSensorReading(100, "volts", "celsius");
        expect(res.isUnknown).toBe(true);
        expect(res.error).toBeDefined();
      });
    });

    describe("Pressure conversions", () => {
      it("converts bar to psi correctly", () => {
        // 10 bar = ~145.04 psi
        const res = normalizeSensorReading(10, "bar", "psi");
        expect(res.value).toBe(145.04);
        expect(res.unit).toBe("psi");
        expect(res.isConverted).toBe(true);
      });

      it("converts kPa to psi correctly", () => {
        // 500 kPa = ~72.52 psi
        const res = normalizeSensorReading(500, "kpa", "psi");
        expect(res.value).toBe(72.52);
        expect(res.isConverted).toBe(true);
      });

      it("converts MPa to psi correctly", () => {
        // 1 MPa = ~145.04 psi
        const res = normalizeSensorReading(1, "mpa", "psi");
        expect(res.value).toBe(145.04);
      });

      it("converts atm to psi correctly", () => {
        // 1 atm = ~14.7 psi
        const res = normalizeSensorReading(1, "atm", "psi");
        expect(res.value).toBe(14.7);
      });

      it("flags unknown unit for pressure sensor", () => {
        const res = normalizeSensorReading(50, "liters", "psi");
        expect(res.isUnknown).toBe(true);
      });
    });

    describe("Vibration velocity conversions", () => {
      it("converts in/s (ips) to mm/s correctly", () => {
        // 0.2 ips * 25.4 = 5.08 mm/s
        const res = normalizeSensorReading(0.2, "in/s", "mm/s");
        expect(res.value).toBe(5.08);
        expect(res.isConverted).toBe(true);
      });

      it("flags unknown unit for vibration sensor", () => {
        const res = normalizeSensorReading(5, "kg", "mm/s");
        expect(res.isUnknown).toBe(true);
      });
    });

    describe("Current conversions", () => {
      it("converts mA to amps correctly", () => {
        const res = normalizeSensorReading(45000, "mA", "amps");
        expect(res.value).toBe(45);
        expect(res.isConverted).toBe(true);
      });

      it("flags unknown unit for current", () => {
        const res = normalizeSensorReading(10, "meters", "amps");
        expect(res.isUnknown).toBe(true);
      });
    });

    describe("Speed, Drift, Flow, Percentage conversions", () => {
      it("converts ft/min to m/s", () => {
        const res = normalizeSensorReading(300, "ft/min", "m/s");
        expect(res.value).toBe(1.524);
      });

      it("converts ft/s to m/s", () => {
        const res = normalizeSensorReading(10, "ft/s", "m/s");
        expect(res.value).toBe(3.048);
      });

      it("converts inches to mm", () => {
        const res = normalizeSensorReading(1.5, "in", "mm");
        expect(res.value).toBe(38.1);
      });

      it("converts cm to mm", () => {
        const res = normalizeSensorReading(2.5, "cm", "mm");
        expect(res.value).toBe(25);
      });

      it("converts L/min to ml/min", () => {
        const res = normalizeSensorReading(0.05, "L/min", "ml/min");
        expect(res.value).toBe(50);
      });

      it("accepts percent variations", () => {
        const res = normalizeSensorReading(5, "%", "percent");
        expect(res.value).toBe(5);
        expect(res.isUnknown).toBe(false);
      });

      it("flags unsupported canonical target unit", () => {
        const res = normalizeSensorReading(10, "unit", "unsupported_unit");
        expect(res.isUnknown).toBe(true);
      });
    });
  });

  // =========================================================================
  // 3. THRESHOLD BOUNDARY EVALUATIONS
  // =========================================================================
  describe("evaluateThresholds - Boundary Analysis", () => {
    // Limits for centrifugal_pump bearing_temp_c:
    // normal: 35-70, warningHigh: 75, criticalHigh: 85. isSafetyRelevant: true.

    it("returns empty array when readings are empty or undefined", () => {
      expect(evaluateThresholds("centrifugal_pump", [])).toEqual([]);
      expect(evaluateThresholds("centrifugal_pump", undefined)).toEqual([]);
    });

    it("returns empty array for normal reading within limits", () => {
      const findings = evaluateThresholds("centrifugal_pump", [
        { key: "bearing_temp_c", value: 60, unit: "celsius" },
      ]);
      expect(findings).toEqual([]);
    });

    describe("Warning High boundary (threshold = 75°C)", () => {
      it("does NOT trigger when just below warning threshold (74.99°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 74.99, unit: "celsius" },
        ]);
        expect(findings).toEqual([]);
      });

      it("TRIGGERS warning when EXACTLY EQUAL to warning threshold (75.0°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 75.0, unit: "celsius" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].priorityFloor).toBe("high"); // safety-relevant
        expect(findings[0].threshold).toBe(75);
        expect(findings[0].measured).toBe(75);
        expect(findings[0].unit).toBe("celsius");
        expect(findings[0].message).toContain("reached WARNING high threshold");
      });

      it("TRIGGERS warning when just above warning threshold (75.01°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 75.01, unit: "celsius" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].priorityFloor).toBe("high");
        expect(findings[0].measured).toBe(75.01);
      });
    });

    describe("Critical High boundary (threshold = 85°C)", () => {
      it("TRIGGERS warning (not critical) when just below critical threshold (84.99°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 84.99, unit: "celsius" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].priorityFloor).toBe("high");
      });

      it("TRIGGERS critical when EXACTLY EQUAL to critical threshold (85.0°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 85.0, unit: "celsius" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("critical");
        expect(findings[0].priorityFloor).toBe("critical");
        expect(findings[0].threshold).toBe(85);
        expect(findings[0].measured).toBe(85);
        expect(findings[0].unit).toBe("celsius");
        expect(findings[0].message).toContain("reached CRITICAL high threshold");
      });

      it("TRIGGERS critical when just above critical threshold (85.01°C)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 85.01, unit: "celsius" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("critical");
        expect(findings[0].priorityFloor).toBe("critical");
        expect(findings[0].measured).toBe(85.01);
      });
    });

    describe("Warning Low and Critical Low boundaries", () => {
      // centrifugal_pump discharge_pressure_psi:
      // normal: 60-120, warningLow: 50, criticalLow: 35. isSafetyRelevant: true.

      it("does NOT trigger when just above warningLow (50.01 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 50.01, unit: "psi" },
        ]);
        expect(findings).toEqual([]);
      });

      it("TRIGGERS warningLow when EXACTLY EQUAL to warningLow (50.0 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 50.0, unit: "psi" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].threshold).toBe(50);
        expect(findings[0].measured).toBe(50);
        expect(findings[0].unit).toBe("psi");
        expect(findings[0].message).toContain("reached WARNING low threshold");
      });

      it("TRIGGERS warningLow when just below warningLow (49.99 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 49.99, unit: "psi" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].measured).toBe(49.99);
      });

      it("TRIGGERS warningLow when just above criticalLow (35.01 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 35.01, unit: "psi" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
      });

      it("TRIGGERS criticalLow when EXACTLY EQUAL to criticalLow (35.0 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 35.0, unit: "psi" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("critical");
        expect(findings[0].priorityFloor).toBe("critical");
        expect(findings[0].threshold).toBe(35);
        expect(findings[0].measured).toBe(35);
        expect(findings[0].message).toContain("reached CRITICAL low threshold");
      });

      it("TRIGGERS criticalLow when below criticalLow (34.99 psi)", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "discharge_pressure_psi", value: 34.99, unit: "psi" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("critical");
        expect(findings[0].priorityFloor).toBe("critical");
      });
    });

    describe("Non-safety-relevant sensor priority floor", () => {
      // centrifugal_pump motor_current_amps:
      // warningHigh: 45, criticalHigh: 52, isSafetyRelevant: undefined (false).
      it("assigns priorityFloor 'medium' for warning on non-safety sensor", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "motor_current_amps", value: 48, unit: "amps" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].priorityFloor).toBe("medium");
      });

      it("assigns priorityFloor 'critical' for critical on any sensor", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "motor_current_amps", value: 55, unit: "amps" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("critical");
        expect(findings[0].priorityFloor).toBe("critical");
      });
    });

    describe("Unit conversion during threshold evaluation", () => {
      it("normalizes Fahrenheit to Celsius to trigger warning threshold", () => {
        // 167°F = 75°C (warningHigh for pump bearing_temp_c)
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 167, unit: "°F" },
        ]);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe("warning");
        expect(findings[0].measured).toBe(75);
        expect(findings[0].threshold).toBe(75);
        expect(findings[0].unit).toBe("celsius");
      });

      it("skips threshold evaluation when unit is unknown rather than guessing", () => {
        const findings = evaluateThresholds("centrifugal_pump", [
          { key: "bearing_temp_c", value: 999, unit: "furlongs" },
        ]);
        expect(findings).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  // 4. DETERMINISTIC SAFETY KEYWORD RULES
  // =========================================================================
  describe("evaluateKeywordRules", () => {
    it("returns empty array for safe, benign input", () => {
      const findings = evaluateKeywordRules("Routine oil change and inspection scheduled", [
        { description: "Standard shift handover completed" },
      ]);
      expect(findings).toEqual([]);
    });

    it("triggers critical floor for 'fire'", () => {
      const findings = evaluateKeywordRules("Small fire observed near pump motor terminal box");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-fire");
      expect(findings[0].severity).toBe("critical");
      expect(findings[0].priorityFloor).toBe("critical");
      expect(findings[0].message).toContain("Active fire");
    });

    it("triggers critical floor for 'gas leak'", () => {
      const findings = evaluateKeywordRules("Audible hissing sound and gas leak from compressor manifold");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-gas-leak");
      expect(findings[0].priorityFloor).toBe("critical");
    });

    it("triggers critical floor for 'ammonia'", () => {
      const findings = evaluateKeywordRules("Pungent ammonia fumes detected in chiller equipment room");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-ammonia");
      expect(findings[0].priorityFloor).toBe("critical");
    });

    it("triggers critical floor for 'electric shock'", () => {
      const findings = evaluateKeywordRules("Technician reported mild electric shock when touching casing");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-electric-shock");
      expect(findings[0].priorityFloor).toBe("critical");
    });

    it("triggers critical floor for 'oil on electrical'", () => {
      const findings = evaluateKeywordRules("Lube oil on electrical motor junction box");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-oil-on-electrical");
      expect(findings[0].priorityFloor).toBe("critical");
    });

    it("triggers high floor for 'smoke'", () => {
      const findings = evaluateKeywordRules("White smoke drifting from motor air vents");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-smoke");
      expect(findings[0].priorityFloor).toBe("high");
      expect(findings[0].severity).toBe("warning");
    });

    it("triggers high floor for 'sparking'", () => {
      const findings = evaluateKeywordRules("Continuous sparking seen at conveyor drive motor brushes");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-sparking");
      expect(findings[0].priorityFloor).toBe("high");
    });

    it("triggers high floor for 'burning smell'", () => {
      const findings = evaluateKeywordRules("Operator noticed strong burning smell near head pulley");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-burning-smell");
      expect(findings[0].priorityFloor).toBe("high");
    });

    it("triggers high floor for 'unusual loud bang'", () => {
      const findings = evaluateKeywordRules("Heard an unusual loud bang before conveyor tripped off");
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe("safety-keyword-unusual-loud-bang");
      expect(findings[0].priorityFloor).toBe("high");
    });

    it("detects keywords inside events array (both objects and strings)", () => {
      const findings = evaluateKeywordRules("Machine stopped unexpectedly", [
        { description: "Operator noticed dense smoke rising from bearing" },
        "Followed by sparking at electrical panel",
      ]);
      expect(findings).toHaveLength(2);
      const ruleIds = findings.map((f) => f.ruleId);
      expect(ruleIds).toContain("safety-keyword-smoke");
      expect(ruleIds).toContain("safety-keyword-sparking");
    });

    it("is case-insensitive", () => {
      const findings = evaluateKeywordRules("EXTREME FIRE HAZARD AND SMOKING");
      expect(findings).toHaveLength(2);
    });
  });

  // =========================================================================
  // 5. DATA QUALITY DETECTION
  // =========================================================================
  describe("detectDataQuality", () => {
    const fixedNow = new Date("2026-10-05T12:00:00Z");

    describe("(a) Missing data", () => {
      it("flags when no sensor readings at all are provided", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [],
        });
        expect(flags).toHaveLength(1);
        expect(flags[0].type).toBe("missing");
        expect(flags[0].message).toContain("No sensor telemetry provided");
      });

      it("flags missing expected sensor keys when partial readings are provided", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [
            { key: "bearing_temp_c", value: 50, unit: "celsius" },
          ],
        });
        // 5 other expected keys should be flagged as missing
        const missingFlags = flags.filter((f) => f.type === "missing");
        expect(missingFlags.length).toBe(5);
        const missingKeys = missingFlags.flatMap((f) => f.relatedKeys);
        expect(missingKeys).toContain("vibration_rms_mms");
        expect(missingKeys).toContain("discharge_pressure_psi");
        expect(missingKeys).toContain("suction_pressure_psi");
        expect(missingKeys).toContain("motor_current_amps");
        expect(missingKeys).toContain("seal_leakage_flow_mlpm");
      });
    });

    describe("(b) Out of range data & unknown units", () => {
      it("flags reading below plausibleMin (likely sensor fault)", () => {
        // pump bearing_temp_c plausibleMin is -10°C
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [
            { key: "bearing_temp_c", value: -50, unit: "celsius" },
          ],
        });
        const outOfRange = flags.find((f) => f.type === "out_of_range");
        expect(outOfRange).toBeDefined();
        expect(outOfRange?.message).toContain("outside plausible physical range");
        expect(outOfRange?.relatedKeys).toContain("bearing_temp_c");
      });

      it("flags reading above plausibleMax (likely sensor fault)", () => {
        // pump bearing_temp_c plausibleMax is 200°C
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [
            { key: "bearing_temp_c", value: 350, unit: "celsius" },
          ],
        });
        const outOfRange = flags.find((f) => f.type === "out_of_range");
        expect(outOfRange).toBeDefined();
        expect(outOfRange?.message).toContain("outside plausible physical range");
      });

      it("flags unknown unit as out_of_range data quality issue", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [
            { key: "bearing_temp_c", value: 70, unit: "unknown_unit" },
          ],
        });
        const flag = flags.find((f) => f.type === "out_of_range");
        expect(flag).toBeDefined();
        expect(flag?.message).toContain("unrecognized or incompatible unit");
      });
    });

    describe("(c) Conflicts", () => {
      it("flags conflict when description says 'frozen' but temperature is elevated", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          issueDescription: "Unit appears frozen solid and iced over",
          sensorReadings: [
            { key: "bearing_temp_c", value: 80, unit: "celsius" },
          ],
        });
        const conflict = flags.find((f) => f.type === "conflict");
        expect(conflict).toBeDefined();
        expect(conflict?.message).toContain("mentions cold/frozen operating condition");
        expect(conflict?.relatedKeys).toContain("bearing_temp_c");
      });

      it("flags conflict when description says 'no vibration' but vibration is elevated", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          issueDescription: "Machine runs smoothly with no vibration at all",
          sensorReadings: [
            { key: "vibration_rms_mms", value: 6.0, unit: "mm/s" },
          ],
        });
        const conflict = flags.find((f) => f.type === "conflict");
        expect(conflict).toBeDefined();
        expect(conflict?.message).toContain("reports no vibration");
        expect(conflict?.relatedKeys).toContain("vibration_rms_mms");
      });

      it("flags conflict when duplicate readings with differing values exist for same key", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          sensorReadings: [
            { key: "bearing_temp_c", value: 45, unit: "celsius" },
            { key: "bearing_temp_c", value: 85, unit: "celsius" },
          ],
        });
        const conflict = flags.find((f) => f.type === "conflict");
        expect(conflict).toBeDefined();
        expect(conflict?.message).toContain("duplicate contradictory readings");
        expect(conflict?.relatedKeys).toContain("bearing_temp_c");
      });

      it("flags conflict when sensor reading timestamp is older than reported event", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          recentEvents: [
            { description: "Sudden shutdown", occurredAt: "2026-10-05T10:00:00Z" },
          ],
          sensorReadings: [
            {
              key: "bearing_temp_c",
              value: 50,
              unit: "celsius",
              recordedAt: "2026-10-05T08:00:00Z", // 2 hours before event!
            },
          ],
        });
        const conflict = flags.find((f) => f.type === "conflict");
        expect(conflict).toBeDefined();
        expect(conflict?.message).toContain("older than reported operating event");
        expect(conflict?.relatedKeys).toContain("bearing_temp_c");
      });
    });

    describe("(d) Stale readings (> 24 hours)", () => {
      it("flags readings older than 24 hours as stale", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          now: fixedNow, // 2026-10-05T12:00:00Z
          sensorReadings: [
            {
              key: "bearing_temp_c",
              value: 55,
              unit: "celsius",
              recordedAt: "2026-10-04T10:00:00Z", // 26 hours old
            },
          ],
        });
        const stale = flags.find((f) => f.type === "stale");
        expect(stale).toBeDefined();
        expect(stale?.message).toContain("is stale");
        expect(stale?.relatedKeys).toContain("bearing_temp_c");
      });

      it("does not flag fresh readings as stale (< 24 hours)", () => {
        const flags = detectDataQuality({
          equipmentType: "centrifugal_pump",
          now: fixedNow,
          sensorReadings: [
            {
              key: "bearing_temp_c",
              value: 55,
              unit: "celsius",
              recordedAt: "2026-10-05T11:00:00Z", // 1 hour old
            },
          ],
        });
        const stale = flags.find((f) => f.type === "stale");
        expect(stale).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // 6. PRIORITY FLOOR COMPUTATION
  // =========================================================================
  describe("computePriorityFloor", () => {
    it("defaults to 'low' and requiresVerification: false when no findings or flags", () => {
      const result = computePriorityFloor([], []);
      expect(result.priorityFloor).toBe("low");
      expect(result.requiresVerification).toBe(false);
    });

    it("takes the highest floor among findings", () => {
      const findings: RuleFinding[] = [
        {
          ruleId: "rule-1",
          severity: "warning",
          priorityFloor: "medium",
          message: "Medium finding",
        },
        {
          ruleId: "rule-2",
          severity: "warning",
          priorityFloor: "high",
          message: "High finding",
        },
      ];
      const result = computePriorityFloor(findings, []);
      expect(result.priorityFloor).toBe("high");
      expect(result.requiresVerification).toBe(false);
    });

    it("sets priorityFloor to 'critical' when critical finding exists", () => {
      const findings: RuleFinding[] = [
        {
          ruleId: "rule-1",
          severity: "critical",
          priorityFloor: "critical",
          message: "Critical finding",
        },
        {
          ruleId: "rule-2",
          severity: "warning",
          priorityFloor: "medium",
          message: "Medium finding",
        },
      ];
      const result = computePriorityFloor(findings, []);
      expect(result.priorityFloor).toBe("critical");
    });

    it("raises priorityFloor to at least 'medium' and sets requiresVerification = true for safety conflict", () => {
      const flags: DataQualityFlag[] = [
        {
          type: "conflict",
          message: "Conflicting bearing temperature readings",
          relatedKeys: ["bearing_temp_c"],
        },
      ];
      const result = computePriorityFloor([], flags, "centrifugal_pump");
      expect(result.priorityFloor).toBe("medium");
      expect(result.requiresVerification).toBe(true);
      expect(result.reasons.some((r) => r.includes("Safety-critical sensor conflict"))).toBe(true);
    });

    it("NEVER lowers priorityFloor due to data conflicts", () => {
      const findings: RuleFinding[] = [
        {
          ruleId: "rule-critical",
          severity: "critical",
          priorityFloor: "critical",
          message: "Critical finding",
        },
      ];
      const flags: DataQualityFlag[] = [
        {
          type: "conflict",
          message: "Conflicting sensor data",
          relatedKeys: ["bearing_temp_c"],
        },
      ];
      const result = computePriorityFloor(findings, flags, "centrifugal_pump");
      // Floor must stay critical, NOT get downgraded to medium
      expect(result.priorityFloor).toBe("critical");
      expect(result.requiresVerification).toBe(true);
    });

    it("checks safety relevance accurately with isSensorSafetyRelevant", () => {
      expect(isSensorSafetyRelevant("bearing_temp_c", "centrifugal_pump")).toBe(true);
      expect(isSensorSafetyRelevant("motor_current_amps", "centrifugal_pump")).toBe(false);
      expect(isSensorSafetyRelevant("vibration_rms_mms")).toBe(true);
    });
  });

  // =========================================================================
  // 7. PRIORITY MERGING & MATHEMATICAL PROOF
  // =========================================================================
  describe("mergePriority & Mathematical Floor Invariant", () => {
    it("returns ruleFloor when ruleFloor > aiSuggested (source: 'rules')", () => {
      const res = mergePriority("high", "low");
      expect(res.finalPriority).toBe("high");
      expect(res.source).toBe("rules");
      expect(res.explanation).toContain("Deterministic safety rule floor");
    });

    it("returns aiSuggested when aiSuggested > ruleFloor (source: 'ai')", () => {
      const res = mergePriority("low", "critical");
      expect(res.finalPriority).toBe("critical");
      expect(res.source).toBe("ai");
      expect(res.explanation).toContain("AI triage suggestion raised priority");
    });

    it("returns agreed priority when ruleFloor === aiSuggested (source: 'both')", () => {
      const res = mergePriority("high", "high");
      expect(res.finalPriority).toBe("high");
      expect(res.source).toBe("both");
      expect(res.explanation).toContain("Deterministic safety rules and AI triage both agree");
    });

    /**
     * MATHEMATICAL PROOF OF NON-NEGOTIABLE RULE 1:
     * For all possible priority combinations (4x4 matrix = 16 cases),
     * mergePriority(ruleFloor, aiSuggested).finalPriority MUST NEVER be lower than ruleFloor.
     */
    it("MATHEMATICAL PROOF: mergePriority can never return lower than ruleFloor for all 16 permutations", () => {
      const levels: PriorityLevel[] = ["low", "medium", "high", "critical"];

      let combinationsTested = 0;

      for (const floor of levels) {
        for (const ai of levels) {
          const result = mergePriority(floor, ai);
          const floorRank = PRIORITY_RANK[floor];
          const finalRank = PRIORITY_RANK[result.finalPriority];

          // 1. Proof that finalPriority is >= ruleFloor
          expect(finalRank).toBeGreaterThanOrEqual(floorRank);

          // 2. Proof that finalPriority equals max(floorRank, aiRank)
          const expectedRank = Math.max(floorRank, PRIORITY_RANK[ai]);
          expect(finalRank).toBe(expectedRank);

          // 3. Source consistency verification
          if (floorRank > PRIORITY_RANK[ai]) {
            expect(result.source).toBe("rules");
            expect(result.finalPriority).toBe(floor);
          } else if (PRIORITY_RANK[ai] > floorRank) {
            expect(result.source).toBe("ai");
            expect(result.finalPriority).toBe(ai);
          } else {
            expect(result.source).toBe("both");
            expect(result.finalPriority).toBe(floor);
          }

          combinationsTested++;
        }
      }

      expect(combinationsTested).toBe(16);
    });
  });
});
