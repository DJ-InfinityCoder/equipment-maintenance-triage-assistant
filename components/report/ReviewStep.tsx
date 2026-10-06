"use client";

import React from "react";
import { IssueReportInput } from "@/lib/schemas/issue-report";
import { LiveRuleFeedback } from "./LiveRuleFeedback";
import {
  Wrench,
  FileText,
  Activity,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  RotateCw,
  WifiOff,
} from "lucide-react";

interface ReviewStepProps {
  formData: IssueReportInput;
  isSubmitting: boolean;
  apiError: string | null;
  onRetrySubmit?: () => void;
}

export function ReviewStep({
  formData,
  isSubmitting,
  apiError,
  onRetrySubmit,
}: ReviewStepProps) {
  const readings = formData.sensorReadings || [];
  const events = formData.recentEvents || [];

  const isDbError =
    !!apiError &&
    (apiError.includes("DatabaseError") ||
      apiError.toLowerCase().includes("database") ||
      apiError.toLowerCase().includes("mongo"));

  const isNetworkError =
    !!apiError &&
    (apiError.includes("Network connection failure") ||
      apiError.toLowerCase().includes("network") ||
      apiError.toLowerCase().includes("failed to fetch"));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Step 4: Review Dossier & Submit
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Review the synthesized issue report, operating events, and live rule evaluations prior to initiating triage.
        </p>
      </div>

      {/* API ERROR / DATABASE ERROR ALERT */}
      {apiError && (
        <div
          role="alert"
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-md border p-4 text-sm shadow-sm animate-in fade-in ${
            isDbError
              ? "border-red-400 bg-red-50 text-red-950 dark:border-red-900/80 dark:bg-red-950/60 dark:text-red-100"
              : isNetworkError
              ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-900/80 dark:bg-amber-950/60 dark:text-amber-100"
              : "border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {isDbError ? (
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            ) : isNetworkError ? (
              <WifiOff className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm">
                  {isDbError
                    ? "DatabaseError: MongoDB Unreachable"
                    : isNetworkError
                    ? "Network Connection Failure"
                    : "Triage Submission Failed"}
                </h4>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200">
                  {isDbError ? "DatabaseError" : isNetworkError ? "NetworkError" : "Error"}
                </span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">{apiError}</p>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Your form data has been completely preserved. No data was lost.
              </p>
            </div>
          </div>

          {onRetrySubmit && (
            <button
              type="button"
              onClick={onRetrySubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 shrink-0 self-start sm:self-auto rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
              {isSubmitting ? "Retrying..." : "Retry Submission"}
            </button>
          )}
        </div>
      )}

      {/* SUBMISSION PROGRESS STATE */}
      {isSubmitting && (
        <div className="rounded-md border border-slate-200 bg-slate-100 p-5 shadow-sm dark:border-slate-300 dark:bg-black/40 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-slate-900 dark:text-slate-700" />
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-600 text-sm">
                Preparing Your Report...
              </h4>
              <p className="text-xs text-slate-900 dark:text-slate-600">
                Applying safety rules, searching manuals, and requesting AI triage. If AI times out, a safety-based draft will still be saved for technician review.
              </p>
            </div>
          </div>

          <div className="pt-2">
            {/* Server-side stages are not streamed, so show one honest in-progress state. */}
            <div
              className="rounded-md p-2.5 text-xs font-semibold flex items-center gap-2 border bg-white text-slate-900 border-slate-200 shadow-xs dark:bg-slate-900 dark:text-slate-600 dark:border-slate-300"
            >
              <Loader2 className="h-4 w-4 animate-spin text-slate-900 shrink-0" />
              <span>Manual retrieval has bounded fallbacks; AI triage has a 60-second deadline</span>
            </div>
          </div>
        </div>
      )}

      {/* LIVE DETERMINISTIC FEEDBACK CARD */}
      <LiveRuleFeedback
        equipmentType={formData.equipmentType}
        issueDescription={formData.issueDescription}
        recentEvents={formData.recentEvents || []}
        sensorReadings={formData.sensorReadings || []}
      />

      {/* SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Equipment Card */}
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Wrench className="h-4 w-4 text-slate-900" />
            Equipment Information
          </div>
          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
              <span className="text-slate-400">Asset Type:</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize">
                {formData.equipmentType.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
              <span className="text-slate-400">Identifier:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formData.equipmentId || "None specified"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Reported By:</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formData.reportedBy || "Anonymous"}
              </span>
            </div>
          </div>
        </div>

        {/* Operating Events Card */}
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <FileText className="h-4 w-4 text-slate-900" />
            Recent Operating Events ({events.length})
          </div>
          <div className="space-y-1.5 text-xs">
            {events.map((evt, idx) => (
              <div
                key={idx}
                className="rounded-md bg-slate-50 p-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
              >
                <div className="font-medium">{evt.description || "No description"}</div>
                {evt.occurredAt && (
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    Time: {evt.occurredAt}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Narrative Description Card */}
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-2 md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <FileText className="h-4 w-4 text-slate-900" />
            Observed Symptoms & Fault Description
          </div>
          <p className="rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            {formData.issueDescription || "No description provided."}
          </p>
        </div>

        {/* Sensor Telemetry Card */}
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Activity className="h-4 w-4 text-emerald-600" />
            Attached Sensor Telemetry ({readings.length})
          </div>
          {readings.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              No sensor readings attached. Triage will run in narrative-only mode.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {readings.map((r, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40 text-xs"
                >
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {r.key}
                  </div>
                  <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    {r.value} <span className="text-xs font-normal opacity-80">{r.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
