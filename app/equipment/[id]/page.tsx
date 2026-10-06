import React from "react";
import Link from "next/link";
import { getEquipmentHistory } from "@/lib/db/repos/equipment";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Wrench,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RotateCw,
  Plus,
  Calendar,
  UserCheck,
  ArrowRight,
} from "lucide-react";

interface EquipmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentHistoryPage({
  params,
}: EquipmentPageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login");
  if (session.role !== "technician") redirect("/report");

  const { id: rawId } = await params;
  const equipmentId = decodeURIComponent(rawId);

  const history = await getEquipmentHistory(equipmentId, { limit: 100 });
  const { equipment, recentTriageRecords, recurrenceInsight } = history;

  const hasRecords = recentTriageRecords.length > 0;
  const equipmentType =
    equipment?.equipmentType ||
    recentTriageRecords[0]?.issueReport.equipmentType ||
    "industrial_equipment";

  const totalIssueCount = equipment?.issueCount ?? recentTriageRecords.length;
  const lastIssueDate =
    equipment?.lastIssueAt || recentTriageRecords[0]?.createdAt;

  return (
    <div className="light-ui min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-black selection:text-white">
      {/* ------------------------------------------------------------------ */}
      {/* TOP HEADER & NAVIGATION                                            */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Return to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-slate-700" />
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Equipment Telemetry History
                </h1>
                <span className="font-mono text-xs font-bold text-slate-700 bg-black/10 border border-slate-300 px-2 py-0.5 rounded-md">
                  {equipmentId}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/report?equipmentId=${encodeURIComponent(equipmentId)}`}
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-800 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Report Issue for {equipmentId}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ------------------------------------------------------------------ */}
        {/* 1. EQUIPMENT OVERVIEW CARD                                         */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-md border border-slate-800 bg-slate-800/40 p-6 backdrop-blur-sm shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white font-mono tracking-tight">
                  {equipmentId}
                </span>
                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold uppercase text-slate-300 border border-slate-700">
                  {equipmentType.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Asset lifecycle telemetry, confirmed fault log, and chronological triage timeline.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Incidents
                </span>
                <span className="text-xl font-black font-mono text-white">
                  {totalIssueCount}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Latest Incident
                </span>
                <span className="text-xs font-mono font-medium text-slate-300">
                  {lastIssueDate
                    ? new Date(lastIssueDate).toLocaleDateString()
                    : "No incidents recorded"}
                </span>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* 2. RECURRENCE INDICATOR (CONFIRMED FINDINGS ONLY - NON-NEGOTIABLE) */}
          {/* ---------------------------------------------------------------- */}
          {recurrenceInsight.hasRecurrence ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <RotateCw className="h-4 w-4 animate-spin-slow" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Recurrence Pattern Detected
                    </span>
                    <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-200">
                      Technician Verified
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-white">
                    {recurrenceInsight.message}
                  </h3>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Derived strictly by counting repeated cause keywords across past human technician confirmed findings (AI hypotheses excluded). Indicates a persistent component vulnerability.
                  </p>

                  {/* Matching past confirmed findings list */}
                  {recurrenceInsight.matchingFindings.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-amber-500/20 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                        Corroborating Confirmed Findings:
                      </span>
                      {recurrenceInsight.matchingFindings.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[11px] bg-amber-950/40 border border-amber-500/20 rounded-md px-2.5 py-1.5 text-amber-100"
                        >
                          <span className="font-medium">&ldquo;{f.text}&rdquo;</span>
                          <span className="text-[10px] text-amber-300/70 shrink-0 ml-2 font-mono">
                            {f.recordedBy} &bull; {new Date(f.recordedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-200 font-medium">
                {recurrenceInsight.message}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 3. CHRONOLOGICAL TIMELINE OF ALL ISSUES                            */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-700" />
              Incident Timeline ({recentTriageRecords.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Chronological &bull; Newest First
            </span>
          </div>

          {!hasRecords ? (
            /* EMPTY STATE */
            <div className="rounded-md border border-slate-800 bg-slate-800/20 p-12 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <Wrench className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-white">
                  No Historical Incidents for {equipmentId}
                </h3>
                <p className="text-xs text-slate-400">
                  This equipment has zero logged telemetry issues or triage evaluations on record.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href={`/report?equipmentId=${encodeURIComponent(equipmentId)}`}
                  className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Initiate Triage Report
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-800">
              {recentTriageRecords.map((rec) => {
                const isCritical = rec.finalPriority === "critical";
                const isHigh = rec.finalPriority === "high";
                const date = new Date(rec.createdAt);

                return (
                  <div key={rec.id} className="relative flex items-start gap-4 pl-1">
                    {/* TIMELINE MARKER */}
                    <div
                      className={`h-9 w-9 rounded-md border flex items-center justify-center shrink-0 z-10 shadow-xs ${
                        isCritical
                          ? "bg-red-950 border-red-500 text-red-400"
                          : isHigh
                          ? "bg-amber-950 border-amber-500 text-amber-400"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Clock className="h-4 w-4" />
                      )}
                    </div>

                    {/* INCIDENT CARD */}
                    <div className="flex-1 rounded-md border border-slate-800 bg-slate-800/40 p-5 backdrop-blur-sm space-y-4 hover:border-slate-700 transition-colors">
                      {/* CARD HEADER */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Priority Badge */}
                          <span
                            className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase border ${
                              isCritical
                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                : isHigh
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-black/10 text-slate-700 border-slate-300"
                            }`}
                          >
                            Priority: {rec.finalPriority}
                          </span>

                          {/* Decision Badge */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                              rec.workOrder.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : rec.workOrder.status === "rejected"
                                ? "bg-red-500/10 text-red-300 border-red-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {rec.workOrder.status === "approved" && (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            )}
                            {rec.workOrder.status === "rejected" && (
                              <XCircle className="h-3 w-3 text-red-400" />
                            )}
                            {rec.workOrder.status === "draft" && (
                              <Clock className="h-3 w-3 text-amber-400" />
                            )}
                            Status: {rec.workOrder.status}
                          </span>

                          {/* Technician Decided Info */}
                          {rec.workOrder.approvedBy && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
                              <UserCheck className="h-3 w-3 text-slate-700" />
                              Technician: {rec.workOrder.approvedBy}
                            </span>
                          )}
                        </div>

                        {/* Date Timestamp */}
                        <span className="text-xs text-slate-400 font-mono">
                          {date.toLocaleDateString()} at{" "}
                          {date.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* ISSUE SUMMARY */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Report Summary &bull; Reported by {rec.issueReport.reportedBy}
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3 rounded-md border border-slate-800">
                          {rec.issueReport.issueDescription}
                        </p>
                      </div>

                      {/* CONFIRMED FINDINGS (Strictly Human Technician) */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Confirmed Technician Findings ({rec.confirmedFindings?.length || 0})</span>
                        </div>

                        {rec.confirmedFindings && rec.confirmedFindings.length > 0 ? (
                          <div className="space-y-1.5">
                            {rec.confirmedFindings.map((f, fIdx) => (
                              <div
                                key={fIdx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-md text-emerald-200"
                              >
                                <span className="font-medium">&ldquo;{f.text}&rdquo;</span>
                                <span className="text-[10px] font-mono text-emerald-400/80 shrink-0">
                                  Verified by {f.recordedBy} &bull; {new Date(f.recordedAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">
                            No technician confirmed findings were recorded for this incident.
                          </p>
                        )}
                      </div>

                      {/* CARD FOOTER & ACTIONS */}
                      <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          <span>
                            Sensors attached: {rec.issueReport.sensorReadings?.length || 0}
                          </span>
                          <span>&bull;</span>
                          <span>
                            Operating events: {rec.issueReport.recentEvents?.length || 0}
                          </span>
                        </div>

                        <Link
                          href={`/triage/${rec.id}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-black/10 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-800 transition-all cursor-pointer self-start sm:self-auto"
                        >
                          View Full Triage Dossier
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
