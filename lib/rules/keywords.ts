import { RuleFinding } from "../schemas/rules";
import { PriorityLevel } from "../schemas/priority";

export interface SafetyKeywordDefinition {
  ruleId: string;
  name: string;
  pattern: RegExp;
  priorityFloor: PriorityLevel;
  severity: "warning" | "critical";
  message: string;
}

export const SAFETY_KEYWORD_RULES: SafetyKeywordDefinition[] = [
  {
    ruleId: "safety-keyword-fire",
    name: "Fire Hazard",
    pattern: /\b(?:fire|flames?|ignit(?:ed?|ion))\b/i,
    priorityFloor: "critical",
    severity: "critical",
    message:
      "Active fire or flame reported. Immediate equipment emergency shutdown and facility evacuation required.",
  },
  {
    ruleId: "safety-keyword-gas-leak",
    name: "Gas Leak Hazard",
    pattern: /\bgas\s+leak\b/i,
    priorityFloor: "critical",
    severity: "critical",
    message:
      "Pressurised gas leak reported. Immediate isolation and hazardous gas mitigation protocol required.",
  },
  {
    ruleId: "safety-keyword-ammonia",
    name: "Toxic Ammonia Leak",
    pattern: /\bammonia\b/i,
    priorityFloor: "critical",
    severity: "critical",
    message:
      "Toxic ammonia release reported. Immediate breathing apparatus protocol and area evacuation required.",
  },
  {
    ruleId: "safety-keyword-electric-shock",
    name: "Electrical Shock Hazard",
    pattern: /\b(?:electric(?:al)?\s+shock|electrocution)\b/i,
    priorityFloor: "critical",
    severity: "critical",
    message:
      "Electric shock incident or imminent shock hazard reported. Lockout/tagout (LOTO) immediately.",
  },
  {
    ruleId: "safety-keyword-oil-on-electrical",
    name: "Oil on Electrical Equipment",
    pattern:
      /\b(?:oil\s+on\s+electrical|oil\s+(?:on|in|leaking\s+onto)\s+(?:motor|junction|wiring|cabinet|electrical))\b/i,
    priorityFloor: "critical",
    severity: "critical",
    message:
      "Lube/hydraulic oil contamination on electrical components reported. High risk of electrical arc flashover and fire.",
  },
  {
    ruleId: "safety-keyword-smoke",
    name: "Smoke Emission",
    pattern: /\b(?:smoke|smoking)\b/i,
    priorityFloor: "high",
    severity: "warning",
    message:
      "Visible smoke emission reported. Suspected severe thermal degradation, winding burn, or friction fire hazard.",
  },
  {
    ruleId: "safety-keyword-sparking",
    name: "Sparking / Arcing",
    pattern: /\b(?:sparking|sparks?|arcing)\b/i,
    priorityFloor: "high",
    severity: "warning",
    message:
      "Electrical sparking or arcing reported. Inspect brush contacts, terminal blocks, and motor grounding.",
  },
  {
    ruleId: "safety-keyword-burning-smell",
    name: "Burning Smell",
    pattern: /\b(?:burning\s+smell|smell(?:s)?\s+of\s+burning|acrid\s+(?:smell|odor))\b/i,
    priorityFloor: "high",
    severity: "warning",
    message:
      "Burning smell reported. Overheating insulation, belt slippage friction, or bearing seizure suspected.",
  },
  {
    ruleId: "safety-keyword-unusual-loud-bang",
    name: "Unusual Loud Bang",
    pattern: /\b(?:unusual\s+loud\s+bang|loud\s+bang|loud\s+explosion)\b/i,
    priorityFloor: "high",
    severity: "warning",
    message:
      "Unusual loud bang reported. Major mechanical shock, catastrophic bearing disintegration, or overpressure release suspected.",
  },
];

/**
 * Deterministically scans issue descriptions and operating events for life-safety keywords.
 * Pure function with zero I/O.
 */
export function evaluateKeywordRules(
  issueDescription?: string,
  events?: Array<{ description: string } | string>
): RuleFinding[] {
  const texts: string[] = [];

  if (issueDescription && issueDescription.trim().length > 0) {
    texts.push(issueDescription);
  }

  if (events && Array.isArray(events)) {
    for (const evt of events) {
      if (typeof evt === "string" && evt.trim().length > 0) {
        texts.push(evt);
      } else if (evt && typeof evt === "object" && typeof evt.description === "string") {
        if (evt.description.trim().length > 0) {
          texts.push(evt.description);
        }
      }
    }
  }

  if (texts.length === 0) {
    return [];
  }

  const combinedText = texts.join(" \n ");
  const findings: RuleFinding[] = [];

  for (const rule of SAFETY_KEYWORD_RULES) {
    if (rule.pattern.test(combinedText)) {
      findings.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        message: rule.message,
        priorityFloor: rule.priorityFloor,
      });
    }
  }

  return findings;
}
