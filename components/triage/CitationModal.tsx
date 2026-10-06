"use client";

import React from "react";
import { Citation } from "@/lib/schemas/citation";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { getSensorLimit } from "@/lib/rules/limits";
import { X, BookOpen, Clock, Activity, ExternalLink } from "lucide-react";

interface CitationModalProps {
  citation: Citation | null;
  record: TriageRecord;
  onClose: () => void;
}

export function CitationModal({ citation, record, onClose }: CitationModalProps) {
  if (!citation) return null;

  let title = "Verifiable Citation Reference";
  let contentNode: React.ReactNode = null;

  if (citation.type === "kb") {
    title = `Knowledge Base Chunk: [KB:${citation.chunkId}]`;
    const chunkId = citation.chunkId;
    const manualDoc = record.retrievedChunkIds.includes(chunkId);

    contentNode = (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 dark:bg-black dark:text-slate-600 border border-slate-200 dark:border-slate-300">
          <BookOpen className="h-4 w-4" />
          <span>Manual Source Reference</span>
          {manualDoc && <span className="ml-auto text-[11px]">&bull; In Retrieved Chunks</span>}
        </div>

        {citation.quote && (
          <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 mb-1">
              Cited Verbatim Excerpt:
            </div>
            <p className="text-xs italic text-amber-900 dark:text-amber-200 leading-relaxed font-serif">
              &ldquo;{citation.quote}&rdquo;
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Chunk Identifier:
          </div>
          <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2.5 rounded-md text-slate-800 dark:text-slate-200 break-all">
            {citation.chunkId}
          </p>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          This diagnostic hypothesis or inspection procedure was verified and grounded directly in the manufacturer technical manual.
        </p>
      </div>
    );
  } else if (citation.type === "event") {
    title = `Operating Event Reference: [EVT:${citation.eventIndex}]`;
    const event = record.issueReport.recentEvents[citation.eventIndex];

    contentNode = (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 dark:bg-black dark:text-slate-600 border border-slate-200 dark:border-slate-300">
          <Clock className="h-4 w-4" />
          <span>Reported Operating Event #{citation.eventIndex + 1}</span>
        </div>

        {event ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Event Description:
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {event.description}
            </p>
            {event.occurredAt && (
              <div className="text-xs text-slate-500 font-mono pt-1">
                Timestamp: {event.occurredAt}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-red-500">
            Event index {citation.eventIndex} was not found in the report payload.
          </p>
        )}
      </div>
    );
  } else if (citation.type === "sensor") {
    title = `Sensor Reading Telemetry: [SENSOR:${citation.key}]`;
    const reading = (record.issueReport.sensorReadings || []).find(
      (r) => r.key === citation.key
    );
    const limit = getSensorLimit(record.issueReport.equipmentType, citation.key);

    contentNode = (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
          <Activity className="h-4 w-4" />
          <span>Active Sensor Telemetry Reference</span>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-700">
            <span className="text-xs text-slate-500">Metric Key:</span>
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              {citation.key}
            </span>
          </div>

          {reading ? (
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-700">
              <span className="text-xs text-slate-500">Measured Value:</span>
              <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-slate-700">
                {reading.value} {reading.unit}
              </span>
            </div>
          ) : (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Not provided in telemetry payload (limit reference only).
            </div>
          )}

          {limit && (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <div>Sensor Name: <span className="font-semibold">{limit.name}</span></div>
              <div>Normal Range: {limit.normalMin ?? 0} &ndash; {limit.normalMax} {limit.unit}</div>
              {limit.warningHigh && (
                <div className="text-amber-600 font-medium">
                  Warning High Limit: &ge;{limit.warningHigh} {limit.unit}
                </div>
              )}
              {limit.criticalHigh && (
                <div className="text-red-600 font-bold">
                  Critical High Limit: &ge;{limit.criticalHigh} {limit.unit}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-md bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-slate-900" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>{contentNode}</div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
