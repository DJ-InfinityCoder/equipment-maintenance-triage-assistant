"use client";

import React, { useMemo } from "react";
import { EquipmentType } from "@/lib/schemas/equipment";
import { SensorReading } from "@/lib/schemas/sensor";
import {
  evaluateThresholds,
  evaluateKeywordRules,
  detectDataQuality,
  computePriorityFloor,
} from "@/lib/rules";
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface LiveRuleFeedbackProps {
  equipmentType: EquipmentType;
  issueDescription: string;
  recentEvents: Array<{ description: string; occurredAt?: string }>;
  sensorReadings?: SensorReading[];
}

export function LiveRuleFeedback({
  equipmentType,
  issueDescription,
  recentEvents,
  sensorReadings = [],
}: LiveRuleFeedbackProps) {
  // Pure deterministic client-side evaluation
  const { criticalFindings, warningFindings, conflictFlags, qualityFlags, floorResult } =
    useMemo(() => {
      // 1. Evaluate thresholds on valid numerical readings
      const validReadings = sensorReadings.filter(
        (r) => r.key?.trim() && !isNaN(Number(r.value)) && r.unit?.trim()
      );

      const thresholdFindings = evaluateThresholds(equipmentType, validReadings);
      const keywordFindings = evaluateKeywordRules(issueDescription, recentEvents);
      const allFindings = [...thresholdFindings, ...keywordFindings];

      const dataFlags = detectDataQuality({
        equipmentType,
        issueDescription,
        recentEvents,
        sensorReadings: validReadings,
      });

      const floor = computePriorityFloor(allFindings, dataFlags, equipmentType);

      const critical = allFindings.filter((f) => f.severity === "critical");
      const warning = allFindings.filter((f) => f.severity === "warning");
      const conflicts = dataFlags.filter((f) => f.type === "conflict");
      const otherQuality = dataFlags.filter((f) => f.type !== "conflict");

      return {
        criticalFindings: critical,
        warningFindings: warning,
        conflictFlags: conflicts,
        qualityFlags: otherQuality,
        floorResult: floor,
      };
    }, [equipmentType, issueDescription, recentEvents, sensorReadings]);

  const hasAnyAlerts =
    criticalFindings.length > 0 ||
    warningFindings.length > 0 ||
    conflictFlags.length > 0;

  return (
    <div
      aria-live="polite"
      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all duration-200"
    >
      {/* Header with clear "Rule check (no AI)" tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-900 dark:text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Live Telemetry & Safety Check
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-900 dark:bg-black/70 dark:text-slate-600 border border-slate-200 dark:border-slate-300">
            Rule check (no AI)
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
              floorResult.priorityFloor === "critical"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border border-red-300"
                : floorResult.priorityFloor === "high"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300"
                : floorResult.priorityFloor === "medium"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 border border-yellow-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300"
            }`}
          >
            Floor: {floorResult.priorityFloor}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {/* CRITICAL FINDINGS (RED) */}
        {criticalFindings.map((finding) => (
          <div
            key={finding.ruleId}
            className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50/90 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <span className="font-semibold text-red-700 dark:text-red-300">
                CRITICAL THRESHOLD:
              </span>{" "}
              {finding.message}
            </div>
          </div>
        ))}

        {/* WARNING FINDINGS (AMBER) */}
        {warningFindings.map((finding) => (
          <div
            key={finding.ruleId}
            className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                SAFETY WARNING:
              </span>{" "}
              {finding.message}
            </div>
          </div>
        ))}

        {/* CONFLICTS (BLUE) */}
        {conflictFlags.map((flag, idx) => (
          <div
            key={`conflict-${idx}`}
            className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-100 p-3 text-sm text-slate-900 dark:border-slate-300 dark:bg-black/40 dark:text-slate-600"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-700" />
            <div className="flex-1">
              <span className="font-semibold text-slate-900 dark:text-slate-600">
                DATA CONFLICT:
              </span>{" "}
              {flag.message}
            </div>
          </div>
        ))}

        {/* OTHER QUALITY FLAGS (BLUE/SLATE) */}
        {qualityFlags
          .filter((f) => f.type === "out_of_range" || f.type === "stale")
          .map((flag, idx) => (
            <div
              key={`qual-${idx}`}
              className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50/70 p-3 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="flex-1">
                <span className="font-semibold text-sky-700 dark:text-sky-300">
                  DATA QUALITY:
                </span>{" "}
                {flag.message}
              </div>
            </div>
          ))}

        {/* ALL CLEAR / NORMAL STATE */}
        {!hasAnyAlerts && (
          <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Telemetry and narrative are within normal baseline thresholds.</span>
          </div>
        )}
      </div>
    </div>
  );
}
