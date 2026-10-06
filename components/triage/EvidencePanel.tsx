"use client";

import React, { useState } from "react";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { Citation } from "@/lib/schemas/citation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmedFinding } from "@/lib/schemas/work-order";
import { FollowUpAnswersPanel } from "./FollowUpAnswersPanel";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Brain,
  HelpCircle,
  CheckSquare,
  UserCheck,
  RotateCw,
  Plus,
  Trash2,
  Lock,
  Layers,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileQuestion,
} from "lucide-react";

interface DroppedItem {
  category: "observation" | "possibleCause" | "followUpQuestion" | "inspectionStep";
  text: string;
  reason: string;
  originalCitations?: Citation[];
}

function getAiErrorDetails(subtype?: string, errorMsg?: string): { title: string; message: string } {
  switch (subtype) {
    case "rate_limit":
      return {
        title: "Rate Limit Exceeded (429)",
        message:
          errorMsg ||
          "Rate limit exceeded (429): Google Gemini API quota temporarily exhausted. Please wait a few moments and try again.",
      };
    case "unavailable":
      return {
        title: "AI Service Unavailable",
        message:
          errorMsg ||
          "The configured AI service is temporarily unavailable or experiencing high load. Please try again shortly.",
      };
    case "configuration":
      return {
        title: "AI Provider Configuration Error",
        message:
          errorMsg ||
          "Configure AI_PROVIDER (gemini or groq) and the API key/model for each provider you want enabled in .env.local, then restart the app.",
      };
    case "timeout":
      return {
        title: "AI Generation Timed Out",
        message:
          errorMsg ||
          "AI generation exceeded the response deadline. Deterministic safety rules remain enforced.",
      };
    case "blocked":
      return {
        title: "Content Blocked by Safety Filters",
        message:
          errorMsg ||
          "Content blocked: The issue description or triage prompt triggered Gemini safety or policy filters. Manual technician inspection required.",
      };
    case "invalid_output":
      return {
        title: "Malformed AI JSON Output / Schema Mismatch",
        message:
          errorMsg ||
          "Malformed JSON / Invalid output: AI response could not be parsed as valid JSON schema. Manual review required.",
      };
    default:
      return {
        title: "AI Triage Generation Unavailable",
        message:
          errorMsg ||
          "AI triage service encountered an error. The deterministic safety floor is enforced.",
      };
  }
}

interface EvidencePanelProps {
  record: TriageRecord;
  onCitationClick: (citation: Citation) => void;
  onRetryTriage: () => void;
  isRetrying: boolean;
  confirmedFindings: ConfirmedFinding[];
  onAddConfirmedFinding: (finding: ConfirmedFinding) => void;
  onRemoveConfirmedFinding: (index: number) => void;
  checkedInspectionSteps: Record<number, boolean>;
  onToggleInspectionStep: (stepNumber: number) => void;
  isSavingAnswers: boolean;
  onSubmitFollowUpAnswers: (
    answers: Array<{ questionIndex: number; answer: string }>
  ) => void;
  isReadOnly?: boolean;
  canManageFindings: boolean;
}

export function EvidencePanel({
  record,
  onCitationClick,
  onRetryTriage,
  isRetrying,
  confirmedFindings,
  onAddConfirmedFinding,
  onRemoveConfirmedFinding,
  checkedInspectionSteps,
  onToggleInspectionStep,
  isSavingAnswers,
  onSubmitFollowUpAnswers,
  isReadOnly = false,
  canManageFindings,
}: EvidencePanelProps) {
  const [newFindingText, setNewFindingText] = useState("");
  const [selectedHypothesisIndex, setSelectedHypothesisIndex] = useState<number | "">("");
  const [showDroppedDetails, setShowDroppedDetails] = useState(true);

  const retrievalFailed = record.retrieval?.status === "failed";
  const retrievalEmpty =
    (record.retrieval?.chunkIds?.length ?? 0) === 0 &&
    (record.retrievedChunkIds?.length ?? 0) === 0 &&
    !retrievalFailed;
  const aiFailed = record.ai?.status === "failed";
  const aiSkipped = record.ai?.status === "skipped_no_context";
  const droppedSuggestions = ((record.ai?.droppedSuggestions as unknown[]) || []) as DroppedItem[];

  const missingSensors = (record.dataQualityFlags || []).filter(
    (f) => f.type === "missing"
  );
  const conflictSensors = (record.dataQualityFlags || []).filter(
    (f) => f.type === "conflict"
  );
  const uncertaintyNotes = record.aiTriage?.uncertaintyNotes || [];

  const aiErrorDetails = aiFailed
    ? getAiErrorDetails(record.ai?.errorSubtype, record.ai?.error)
    : null;

  const handleAddFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFindingText.trim()) return;

    onAddConfirmedFinding({
      text: newFindingText.trim(),
      recordedBy: record.workOrder.approvedBy || "Current Technician",
      recordedAt: new Date().toISOString(),
      relatedCauseIndex:
        typeof selectedHypothesisIndex === "number" ? selectedHypothesisIndex : undefined,
    });

    setNewFindingText("");
    setSelectedHypothesisIndex("");
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION LEGEND                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-2">
          <Layers className="h-3.5 w-3.5" />
          <span>Evidence Classification Legend</span>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-900 dark:bg-black dark:text-slate-600">
            Rule-based (Deterministic)
          </span>
          <span className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Data Quality
          </span>
          <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            Reported Facts
          </span>
          <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 font-semibold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            AI Hypothesis (Probabilistic)
          </span>
          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Technician Confirmed (Human)
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. STATUS BANNER AREA (DEGRADED MODE / RETRY / DROPPED NOTICES)     */}
      {/* ------------------------------------------------------------------ */}
      {(retrievalFailed ||
        retrievalEmpty ||
        aiFailed ||
        aiSkipped ||
        missingSensors.length > 0 ||
        conflictSensors.length > 0 ||
        droppedSuggestions.length > 0) && (
        <div className="space-y-3">
          {/* Retrieval Failure Alert */}
          {retrievalFailed && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200">
                    Knowledge Base Retrieval Failed
                  </h4>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                    Knowledge base retrieval encountered an error. AI triage was skipped because no verified equipment manual chunks could be loaded. Deterministic safety rules remain fully active below.
                    {record.retrieval?.error && ` (Error: ${record.retrieval.error})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetryTriage}
                disabled={isRetrying || isReadOnly}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry Retrieval"}
              </button>
            </div>
          )}

          {/* Retrieval Empty Alert */}
          {retrievalEmpty && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <FileQuestion className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200">
                    No Equipment Manual Sections Found (0 Chunks Retrieved)
                  </h4>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                    Knowledge base search returned 0 matching manual chunks for this equipment and symptom description. AI triage proposal was safely skipped to prevent ungrounded hallucinations. Deterministic safety rules remain enforced below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetryTriage}
                disabled={isRetrying || isReadOnly}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry Retrieval"}
              </button>
            </div>
          )}

          {/* AI failures retain the deterministic safety floor while surfacing typed errors. */}
          {aiFailed && aiErrorDetails && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-4 text-xs sm:text-sm text-red-950 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-red-900 dark:text-red-200">
                      {aiErrorDetails.title}
                    </h4>
                    {record.ai?.errorSubtype && (
                      <span className="rounded-md px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase bg-red-200 text-red-900 dark:bg-red-900/80 dark:text-red-200">
                        {record.ai.errorSubtype}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-800 dark:text-red-300">
                    {aiErrorDetails.message}
                  </p>
                  <p className="text-[11px] font-medium text-red-700 dark:text-red-400">
                    Deterministic safety floor priority ({record.ruleFloorPriority}) is enforced. Technician manual inspection required.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRetryTriage}
                disabled={isRetrying || isReadOnly}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry AI"}
              </button>
            </div>
          )}

          {/* Missing Sensors Alert Banner */}
          {missingSensors.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-md border border-sky-300 bg-sky-50/80 p-3.5 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sky-900 dark:text-sky-200">
                  Missing Sensor Telemetry Alert ({missingSensors.length})
                </h4>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-sky-800 dark:text-sky-300">
                  {missingSensors.map((flag, idx) => (
                    <li key={idx}>{flag.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Conflicting Sensors Alert Banner */}
          {conflictSensors.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-amber-900 dark:text-amber-200">
                  Contradictory Telemetry Conflict Detected ({conflictSensors.length})
                </h4>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                  {conflictSensors.map((flag, idx) => (
                    <li key={idx}>{flag.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Dropped Suggestions Banner with itemized count and reasons */}
          {droppedSuggestions.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-100 p-3.5 text-xs text-slate-900 dark:border-slate-300 dark:bg-black/30 dark:text-slate-600 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-slate-900 dark:text-slate-700" />
                  <span className="font-bold text-sm">
                    Citation Verification: {droppedSuggestions.length} ungrounded AI suggestion(s) dropped
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDroppedDetails(!showDroppedDetails)}
                  className="inline-flex items-center gap-1 font-semibold text-[11px] text-slate-900 dark:text-slate-600 hover:underline cursor-pointer"
                >
                  {showDroppedDetails ? "Hide Details" : "Show Details"}
                  {showDroppedDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-900 dark:text-slate-600 leading-relaxed">
                The server enforces strict citation grounding. The following items proposed by the AI were removed because they cited non-existent manual chunks, invalid event indices, or lacked source evidence:
              </p>
              {showDroppedDetails && (
                <div className="space-y-2 pt-1">
                  {droppedSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-slate-200 bg-white/80 p-2.5 dark:border-slate-300 dark:bg-slate-900/80 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-900 dark:bg-black dark:text-slate-600">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Dropped Item #{idx + 1}
                        </span>
                      </div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        &ldquo;{item.text}&rdquo;
                      </div>
                      <div className="text-[11px] text-red-600 dark:text-red-400">
                        <span className="font-semibold">Reason: </span>
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. RULE CHECKS (DETERMINISTIC) - BADGE: 'Rule-based'               */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-300 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-900 dark:text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              2. Deterministic Safety Rule Checks
            </h3>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-900 dark:bg-black dark:text-slate-600">
            Rule-based
          </span>
        </div>

        {record.ruleFindings.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No threshold breaches or life-safety keyword triggers detected.
          </p>
        ) : (
          <div className="space-y-2">
            {record.ruleFindings.map((finding) => (
              <div
                key={finding.ruleId}
                className={`rounded-md p-3 text-xs border ${
                  finding.severity === "critical"
                    ? "bg-red-50/80 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200"
                    : "bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span className="uppercase tracking-wide">
                    {finding.severity} Breach &bull; Floor: {finding.priorityFloor}
                  </span>
                  {finding.threshold !== undefined && (
                    <span className="font-mono text-[11px]">
                      Measured: {finding.measured} {finding.unit} &bull; Threshold: {finding.threshold} {finding.unit}
                    </span>
                  )}
                </div>
                <p className="text-xs">{finding.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. DATA QUALITY - BADGE: 'Data Quality'                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-sky-200 bg-white p-4 shadow-xs dark:border-sky-900/60 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2.5 dark:border-sky-900/50">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              3. Data Quality & Conflict Telemetry
            </h3>
          </div>
          <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Data Quality
          </span>
        </div>

        {record.dataQualityFlags.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            All telemetry fields, units, and timestamps are verified consistent.
          </p>
        ) : (
          <div className="space-y-2">
            {record.dataQualityFlags.map((flag, idx) => (
              <div
                key={idx}
                className="rounded-md bg-sky-50/70 border border-sky-200 p-2.5 text-xs text-sky-900 dark:bg-sky-950/30 dark:border-sky-900/60 dark:text-sky-200"
              >
                <div className="font-bold uppercase tracking-wider text-[10px] text-sky-700 dark:text-sky-300">
                  {flag.type.replace(/_/g, " ")}:
                </div>
                <p className="mt-0.5">{flag.message}</p>
                {flag.relatedKeys.length > 0 && (
                  <div className="mt-1 text-[11px] font-mono text-sky-600 dark:text-sky-400">
                    Verify physical sensors: {flag.relatedKeys.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. OBSERVATIONS - BADGE: 'Reported'                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              4. Reported Symptoms & Observations (Facts Only)
            </h3>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Reported
          </span>
        </div>

        <div className="space-y-2">
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-900 dark:text-white">Narrative: </span>
            {record.issueReport.issueDescription}
          </div>

          {record.aiTriage?.observations.map((obs, idx) => (
            <div
              key={idx}
              className="rounded-md border border-slate-100 bg-slate-50/50 p-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300"
            >
              <p>{obs.text}</p>
              {obs.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {obs.citations.map((c, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={() => onCitationClick(c)}
                      className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {c.type === "kb" ? `[KB:${c.chunkId}]` : c.type === "event" ? `[EVT:${c.eventIndex}]` : `[SENSOR:${c.key}]`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. POSSIBLE CAUSES - BADGE: 'AI hypothesis'                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-purple-200 bg-white p-4 shadow-xs dark:border-purple-900/60 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-purple-100 pb-2.5 dark:border-purple-900/50">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              5. Possible Causes (Hypotheses)
            </h3>
          </div>
          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            AI hypothesis
          </span>
        </div>

        {!record.aiTriage?.possibleCauses || record.aiTriage.possibleCauses.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No hypotheses available (AI triage was unavailable or skipped).
          </p>
        ) : (
          <div className="space-y-3">
            {record.aiTriage.possibleCauses.map((cause, idx) => (
              <div
                key={idx}
                className="rounded-md border border-purple-100 bg-purple-50/40 p-3 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:bg-purple-900/60 dark:text-purple-300">
                    Hypothesis #{idx + 1}, not confirmed
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Likelihood: {cause.likelihood}
                  </span>
                </div>

                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {cause.hypothesis}
                </p>

                {/* Citations as clickable chips */}
                {cause.citations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Sources:
                    </span>
                    {cause.citations.map((c, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onClick={() => onCitationClick(c)}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-mono text-purple-900 hover:bg-purple-200 dark:bg-purple-900/70 dark:text-purple-200 cursor-pointer transition-colors"
                      >
                        {c.type === "kb" ? `[KB:${c.chunkId}]` : c.type === "event" ? `[EVT:${c.eventIndex}]` : `[SENSOR:${c.key}]`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. FOLLOW-UP QUESTIONS - BADGE: 'Follow-up Question'               */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-amber-200 bg-white p-4 shadow-xs dark:border-amber-900/60 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-amber-100 pb-2.5 dark:border-amber-900/50">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              6. Diagnostic Follow-Up Questions
            </h3>
          </div>
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Follow-up Question
          </span>
        </div>

        <FollowUpAnswersPanel
          questions={record.aiTriage?.followUpQuestions ?? []}
          answers={record.followUpAnswers ?? []}
          isReadOnly={isReadOnly}
          isSaving={isSavingAnswers}
          onSubmitAnswers={onSubmitFollowUpAnswers}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 7. INSPECTION STEPS - BADGE: 'Inspection Procedure'                */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-teal-200 bg-white p-4 shadow-xs dark:border-teal-900/60 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-teal-100 pb-2.5 dark:border-teal-900/50">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              7. Physical Inspection Checklist
            </h3>
          </div>
          <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
            Inspection Procedure
          </span>
        </div>

        {!record.aiTriage?.inspectionSteps || record.aiTriage.inspectionSteps.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No manual inspection steps referenced.</p>
        ) : (
          <div className="space-y-2.5">
            {record.aiTriage.inspectionSteps.map((step) => {
              const isChecked = !!checkedInspectionSteps[step.order];
              return (
                <div
                  key={step.order}
                  className={`rounded-md border p-3 transition-colors ${
                    isChecked
                      ? "border-teal-300 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/20"
                      : "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isReadOnly}
                      onChange={() => onToggleInspectionStep(step.order)}
                      className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-medium text-slate-900 dark:text-white">
                        <span className="font-bold text-teal-700 dark:text-teal-400 mr-1.5">
                          Step {step.order}:
                        </span>
                        {step.instruction}
                      </div>

                      {/* Safety note highlight */}
                      {step.safetyNote && (
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span>Safety Caution: {step.safetyNote}</span>
                        </div>
                      )}

                      {/* Citation chips */}
                      {step.citations.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {step.citations.map((c, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => onCitationClick(c)}
                              className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 cursor-pointer"
                            >
                              [KB:{c.type === "kb" ? c.chunkId : "ref"}]
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 8. CONFIRMED FINDINGS - BADGE: 'Technician confirmed'              */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-emerald-300 bg-white p-4 shadow-xs dark:border-emerald-900/60 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5 dark:border-emerald-900/50">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              8. Confirmed Findings (Human Technician Only)
            </h3>
          </div>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Technician confirmed
          </span>
        </div>

        {/* Rule 3 Note */}
        <div className="flex items-start gap-2 rounded-md bg-emerald-50/70 p-2.5 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Lock className="h-3.5 w-3.5 mt-0.5 text-emerald-600 shrink-0" />
          <p>
            <span className="font-bold">Human Verification Required: </span>
            The AI is strictly prohibited from writing confirmed findings. Confirmed physical root causes can only be entered by a human field technician upon inspection.
          </p>
        </div>

        {/* List of existing confirmed findings */}
        {confirmedFindings.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No confirmed findings recorded yet. Use the form below to document verified physical causes.
          </p>
        ) : (
          <div className="space-y-2">
            {confirmedFindings.map((finding, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 text-xs text-slate-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-slate-100"
              >
                <div>
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Finding #{idx + 1} &bull; Recorded by {finding.recordedBy}
                    {finding.relatedCauseIndex !== undefined &&
                      ` (Linked to Hypothesis #${finding.relatedCauseIndex + 1})`}
                  </div>
                  <p className="mt-1">{finding.text}</p>
                </div>
                {!isReadOnly && canManageFindings && (
                  <button
                    type="button"
                    onClick={() => onRemoveConfirmedFinding(idx)}
                    title="Remove finding"
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add finding form (disabled if read only) */}
        {!isReadOnly && canManageFindings && (
          <form onSubmit={handleAddFinding} className="pt-2 space-y-2.5">
            <textarea
              rows={2}
              placeholder="Record verified physical finding (e.g. Disassembled seal housing and verified primary carbon face cracked)..."
              value={newFindingText}
              onChange={(e) => setNewFindingText(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select
                value={
                  typeof selectedHypothesisIndex === "number"
                    ? String(selectedHypothesisIndex)
                    : undefined
                }
                onValueChange={(value) =>
                  setSelectedHypothesisIndex(value === "none" ? "" : Number(value))
                }
              >
                <SelectTrigger
                  aria-label="Link confirmed finding to a hypothesis"
                  className="h-9 w-auto min-w-[220px] text-xs"
                >
                  <SelectValue placeholder="Link to Hypothesis (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked hypothesis</SelectItem>
                  {(record.aiTriage?.possibleCauses || []).map((_, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      Hypothesis #{idx + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="submit"
                disabled={!newFindingText.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Record Confirmed Finding
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 9. UNCERTAINTY NOTES - BADGE: 'AI Uncertainty'                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              9. AI Uncertainty & Confidence Notes
            </h3>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            AI Uncertainty
          </span>
        </div>

        {uncertaintyNotes.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            No specific diagnostic uncertainty notes generated.
          </p>
        ) : (
          <div className="space-y-2">
            {uncertaintyNotes.map((note, idx) => (
              <div
                key={idx}
                className="rounded-md bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-slate-800 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 flex items-start gap-2"
              >
                <span className="font-mono text-[10px] text-slate-400 mt-0.5 shrink-0">
                  Note #{idx + 1}
                </span>
                <p className="flex-1 leading-relaxed">{note}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
