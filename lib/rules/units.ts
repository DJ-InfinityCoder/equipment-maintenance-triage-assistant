/**
 * Unit conversion and normalization utilities for sensor telemetry.
 * Pure functions with no I/O.
 */

export interface UnitConversionResult {
  value: number;
  unit: string;
  isConverted: boolean;
  isUnknown: boolean;
  error?: string;
}

/**
 * Normalizes an input unit string for comparison (lowercase, trimmed, stripped of special formatting).
 */
export function normalizeUnitString(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/[°º]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Normalizes a sensor reading value and unit to the canonical unit expected by the limit rule.
 *
 * Supported trivial conversions:
 * - Temperature: Fahrenheit (°F) -> Celsius (°C), Kelvin (K) -> Celsius (°C)
 * - Pressure: bar -> psi, kPa -> psi, MPa -> psi, atm -> psi
 * - Vibration: in/s (ips) -> mm/s
 * - Current: mA -> amps
 * - Speed: ft/min (fpm) -> m/s, ft/s (fps) -> m/s
 * - Length/Drift: in/inch -> mm, cm -> mm
 * - Leakage: L/min -> ml/min
 * - Percentage: %, pct -> percent
 *
 * If unit cannot be safely converted to the target canonical unit, returns isUnknown: true.
 */
export function normalizeSensorReading(
  value: number,
  inputUnit: string,
  targetCanonicalUnit: string
): UnitConversionResult {
  const normInput = normalizeUnitString(inputUnit);
  const normTarget = normalizeUnitString(targetCanonicalUnit);

  // Exact match to canonical unit
  if (normInput === normTarget) {
    return {
      value,
      unit: targetCanonicalUnit,
      isConverted: false,
      isUnknown: false,
    };
  }

  // 1. Celsius targets
  if (normTarget === "celsius" || normTarget === "c") {
    if (["c", "celsius", "degc"].includes(normInput)) {
      return { value, unit: "celsius", isConverted: false, isUnknown: false };
    }
    if (["f", "fahrenheit", "degf"].includes(normInput)) {
      // (F - 32) * 5/9
      const c = (value - 32) * (5 / 9);
      return {
        value: Math.round(c * 100) / 100,
        unit: "celsius",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["k", "kelvin"].includes(normInput)) {
      const c = value - 273.15;
      return {
        value: Math.round(c * 100) / 100,
        unit: "celsius",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to celsius`,
    };
  }

  // 2. PSI targets
  if (normTarget === "psi") {
    if (["psi", "psig", "psia"].includes(normInput)) {
      return { value, unit: "psi", isConverted: false, isUnknown: false };
    }
    if (["bar", "bars"].includes(normInput)) {
      // 1 bar = 14.50377 psi
      const psi = value * 14.503773773;
      return {
        value: Math.round(psi * 100) / 100,
        unit: "psi",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["kpa"].includes(normInput)) {
      const psi = value * 0.14503773773;
      return {
        value: Math.round(psi * 100) / 100,
        unit: "psi",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["mpa"].includes(normInput)) {
      const psi = value * 145.03773773;
      return {
        value: Math.round(psi * 100) / 100,
        unit: "psi",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["atm"].includes(normInput)) {
      const psi = value * 14.695948775;
      return {
        value: Math.round(psi * 100) / 100,
        unit: "psi",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to psi`,
    };
  }

  // 3. Vibration velocity mm/s targets
  if (normTarget === "mm/s" || normTarget === "mms") {
    if (["mm/s", "mms", "mm/sec"].includes(normInput)) {
      return { value, unit: "mm/s", isConverted: false, isUnknown: false };
    }
    if (["in/s", "ips", "in/sec"].includes(normInput)) {
      // 1 in/s = 25.4 mm/s
      const mms = value * 25.4;
      return {
        value: Math.round(mms * 100) / 100,
        unit: "mm/s",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to mm/s`,
    };
  }

  // 4. Electric current amps targets
  if (normTarget === "amps" || normTarget === "a" || normTarget === "amp") {
    if (["amps", "a", "amp", "amperes"].includes(normInput)) {
      return { value, unit: "amps", isConverted: false, isUnknown: false };
    }
    if (["ma", "milliamp", "milliamps"].includes(normInput)) {
      const a = value / 1000;
      return {
        value: Math.round(a * 1000) / 1000,
        unit: "amps",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to amps`,
    };
  }

  // 5. Velocity m/s targets
  if (normTarget === "m/s" || normTarget === "mps") {
    if (["m/s", "mps", "m/sec"].includes(normInput)) {
      return { value, unit: "m/s", isConverted: false, isUnknown: false };
    }
    if (["ft/min", "fpm"].includes(normInput)) {
      const mps = value * 0.00508;
      return {
        value: Math.round(mps * 1000) / 1000,
        unit: "m/s",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["ft/s", "fps"].includes(normInput)) {
      const mps = value * 0.3048;
      return {
        value: Math.round(mps * 1000) / 1000,
        unit: "m/s",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to m/s`,
    };
  }

  // 6. Displacement / Drift mm targets
  if (normTarget === "mm") {
    if (["mm"].includes(normInput)) {
      return { value, unit: "mm", isConverted: false, isUnknown: false };
    }
    if (["in", "inch", "inches"].includes(normInput)) {
      const mm = value * 25.4;
      return {
        value: Math.round(mm * 100) / 100,
        unit: "mm",
        isConverted: true,
        isUnknown: false,
      };
    }
    if (["cm"].includes(normInput)) {
      const mm = value * 10;
      return {
        value: Math.round(mm * 100) / 100,
        unit: "mm",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to mm`,
    };
  }

  // 7. Volumetric flow ml/min targets
  if (normTarget === "ml/min" || normTarget === "mlpm") {
    if (["ml/min", "mlpm", "ml/m"].includes(normInput)) {
      return { value, unit: "ml/min", isConverted: false, isUnknown: false };
    }
    if (["l/min", "lpm"].includes(normInput)) {
      const mlpm = value * 1000;
      return {
        value: Math.round(mlpm * 100) / 100,
        unit: "ml/min",
        isConverted: true,
        isUnknown: false,
      };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to ml/min`,
    };
  }

  // 8. Percentage targets
  if (normTarget === "percent" || normTarget === "%") {
    if (["percent", "%", "pct"].includes(normInput)) {
      return { value, unit: "percent", isConverted: false, isUnknown: false };
    }
    return {
      value,
      unit: inputUnit,
      isConverted: false,
      isUnknown: true,
      error: `Cannot convert '${inputUnit}' to percent`,
    };
  }

  // Fallback if target is unrecognized
  return {
    value,
    unit: inputUnit,
    isConverted: false,
    isUnknown: true,
    error: `Unsupported target canonical unit '${targetCanonicalUnit}'`,
  };
}
