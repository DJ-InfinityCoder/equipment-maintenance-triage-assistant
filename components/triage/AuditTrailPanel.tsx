"use client";

import React, { useState } from "react";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { WorkOrder, AiWorkOrderSnapshot } from "@/lib/schemas/work-order";
import { AuditEvent } from "@/lib/schemas/audit";
import {
  History,
  GitCompare,
  UserCheck,
  Brain,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  HelpCircle,
  CheckSquare,
  Clock,
  Filter,
} from "lucide-react";

interface AuditTrailPanelProps {
  record: TriageRecord;
  workOrder: WorkOrder;
}

export function AuditTrailPanel({ record, workOrder }: AuditTrailPanelProps) {
  const [filterActor, setFilterActor] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Fallback snapshot resolution if aiOriginal wasn't initialized
  const aiDraft: AiWorkOrderSnapshot = workOrder.aiOriginal || {
    title:
      record.aiTriage?.draftWorkOrder.title ||
      `Manual Triage: ${record.issueReport.equipmentType}`,
    description:
      record.aiTriage?.draftWorkOrder.description ||
      "Deterministic rule evaluation baseline without manual AI elaboration.",
    finalPriority: record.aiTriage?.suggestedPriority || record.ruleFloorPriority,
    recommendedActions:
      record.aiTriage?.draftWorkOrder.recommendedActions ||
      record.ruleFindings.map((f) => f.message),
    partsToCheck:
      record.aiTriage?.draftWorkOrder.partsToCheck || ["Drive assembly"],
    createdAt: record.createdAt,
  };

  const isTitleModified = aiDraft.title.trim() !== workOrder.title.trim();
  const isDescModified =
    aiDraft.description.trim() !== workOrder.description.trim();
  const isPriorityModified = aiDraft.finalPriority !== workOrder.finalPriority;

  const addedActions = (workOrder.recommendedActions || []).filter(
    (a) => !aiDraft.recommendedActions.includes(a)
  );
  const removedActions = (aiDraft.recommendedActions || []).filter(
    (a) => !(workOrder.recommendedActions || []).includes(a)
  );

  const addedParts = (workOrder.partsToCheck || []).filter(
    (p) => !aiDraft.partsToCheck.includes(p)
  );
  const removedParts = (aiDraft.partsToCheck || []).filter(
    (p) => !(workOrder.partsToCheck || []).includes(p)
  );

  const totalModifications =
    (isTitleModified ? 1 : 0) +
    (isDescModified ? 1 : 0) +
    (isPriorityModified ? 1 : 0) +
    addedActions.length +
    removedActions.length +
    addedParts.length +
    removedParts.length;

  const events: AuditEvent[] = [...(record.auditTrail || [])].sort((a, b) => {
    const diff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return sortOrder === "desc" ? -diff : diff;
  });

  const filteredEvents = events.filter((e) => {
    if (filterActor === "all") return true;
    return e.actor === filterActor;
  });

  const getEventBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "approved":
      case "work_order_approved":
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          label: "Approved",
          color:
            "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        };
      case "rejected":
      case "work_order_rejected":
        return {
          icon: <XCircle className="h-4 w-4 text-red-500" />,
          label: "Rejected",
          color:
            "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
        };
      case "field_edited":
      case "work_order_draft_updated":
        return {
          icon: <Edit3 className="h-4 w-4 text-amber-500" />,
          label: "Field Edited",
          color:
            "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
        };
      case "priority_changed":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-purple-500" />,
          label: "Priority Changed",
          color:
            "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
        };
      case "finding_added":
        return {
          icon: <ShieldCheck className="h-4 w-4 text-teal-500" />,
          label: "Finding Confirmed",
          color:
            "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
        };
      case "step_completed":
        return {
          icon: <CheckSquare className="h-4 w-4 text-slate-700" />,
          label: "Step Completed",
          color:
            "bg-slate-100 text-slate-900 border-slate-200 dark:bg-black/60 dark:text-slate-600 dark:border-slate-300",
        };
      case "question_answered":
      case "follow_up_answers_submitted":
        return {
          icon: <HelpCircle className="h-4 w-4 text-cyan-500" />,
          label: "Question Answered",
          color:
            "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4 text-slate-500" />,
          label: type.replace(/_/g, " "),
          color:
            "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        };
    }
  };

  const getActorBadge = (actor: string) => {
    switch (actor) {
      case "technician":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-900 dark:bg-black/60 dark:text-slate-600 border border-slate-200 dark:border-slate-300">
            <UserCheck className="h-2.5 w-2.5" /> Technician
          </span>
        );
      case "reporter":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
            <UserCheck className="h-2.5 w-2.5" /> Reporter
          </span>
        );
      case "ai":
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            <Brain className="h-2.5 w-2.5" /> AI Model
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
            System
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* 1. SIDE-BY-SIDE DIFF (AI DRAFT VS TECHNICIAN VERSION)               */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-black/10 border border-slate-300 flex items-center justify-center text-slate-900 dark:text-slate-700">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Draft vs. Technician Review Diff
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {totalModifications === 0
                    ? "Identical to AI Draft"
                    : `${totalModifications} change${totalModifications > 1 ? "s" : ""}`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparing immutable AI draft baseline against human technician edited & approved work order.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`text-xs font-bold uppercase px-2.5 py-1 rounded-md border ${
                workOrder.status === "approved"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : workOrder.status === "rejected"
                  ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                  : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              Current Status: {workOrder.status}
            </span>
          </div>
        </div>

        {/* TWO-COLUMN DIFF GRID */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT: AI ORIGINAL DRAFT */}
          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-500" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  AI Original Baseline
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {aiDraft.createdAt ? new Date(aiDraft.createdAt).toLocaleTimeString() : "At Creation"}
              </span>
            </div>

            {/* AI Priority */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Suggested Priority
              </span>
              <span className="inline-block rounded-md px-2 py-0.5 text-xs font-mono font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {aiDraft.finalPriority}
              </span>
            </div>

            {/* AI Title */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Work Order Title
              </span>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-md border border-slate-200/70 dark:border-slate-800">
                {aiDraft.title}
              </p>
            </div>

            {/* AI Description */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Work Order Description
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-md border border-slate-200/70 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
                {aiDraft.description}
              </p>
            </div>

            {/* AI Recommended Actions */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Recommended Actions ({aiDraft.recommendedActions.length})
              </span>
              <ul className="space-y-1.5 text-xs">
                {aiDraft.recommendedActions.map((act, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-md border border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    <span className="font-mono text-[10px] text-slate-400 mt-0.5">#{i + 1}</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Parts to Check */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Parts to Check ({aiDraft.partsToCheck.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {aiDraft.partsToCheck.map((p, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-mono border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: TECHNICIAN APPROVED / EDITED VERSION */}
          <div className="rounded-md border border-slate-200 bg-slate-100 p-4 dark:border-slate-300 dark:bg-black/20 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-300">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-slate-900 dark:text-slate-700" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                  Technician Version
                </span>
                {workOrder.approvedBy && (
                  <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-700">
                    &bull; {workOrder.approvedBy}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {workOrder.decidedAt
                  ? `Decided ${new Date(workOrder.decidedAt).toLocaleTimeString()}`
                  : `Updated ${new Date(workOrder.updatedAt).toLocaleTimeString()}`}
              </span>
            </div>

            {/* Technician Priority */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Final Priority
                </span>
                {isPriorityModified && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                    Overridden from {aiDraft.finalPriority}
                  </span>
                )}
              </div>
              <span
                className={`inline-block rounded-md px-2 py-0.5 text-xs font-mono font-bold uppercase ${
                  workOrder.finalPriority === "critical"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    : workOrder.finalPriority === "high"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-slate-100 text-slate-900 dark:bg-black dark:text-slate-600"
                }`}
              >
                {workOrder.finalPriority}
              </span>
              {workOrder.technicianEdits?.technicianNotes && (
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 italic">
                  Note: {workOrder.technicianEdits.technicianNotes}
                </p>
              )}
            </div>

            {/* Technician Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Work Order Title
                </span>
                {isTitleModified && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Modified
                  </span>
                )}
              </div>
              <p
                className={`text-xs font-medium p-2.5 rounded-md border leading-relaxed ${
                  isTitleModified
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                {workOrder.title}
              </p>
            </div>

            {/* Technician Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Work Order Description
                </span>
                {isDescModified && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    Modified
                  </span>
                )}
              </div>
              <p
                className={`text-xs p-2.5 rounded-md border whitespace-pre-wrap leading-relaxed ${
                  isDescModified
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                {workOrder.description}
              </p>
            </div>

            {/* Technician Actions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recommended Actions ({workOrder.recommendedActions.length})
                </span>
                {addedActions.length > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    +{addedActions.length} added
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-xs">
                {workOrder.recommendedActions.map((act, i) => {
                  const isNew = addedActions.includes(act);
                  return (
                    <li
                      key={i}
                      className={`flex items-start gap-2 p-2 rounded-md border ${
                        isNew
                          ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 font-medium"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="font-mono text-[10px] opacity-60 mt-0.5">#{i + 1}</span>
                      <span className="flex-1">{act}</span>
                      {isNew && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-md bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
                          Technician Added
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Technician Parts to Check */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Parts to Check ({workOrder.partsToCheck.length})
                </span>
                {addedParts.length > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    +{addedParts.length} added
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workOrder.partsToCheck.map((p, i) => {
                  const isNew = addedParts.includes(p);
                  return (
                    <span
                      key={i}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-mono border ${
                        isNew
                          ? "bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200 font-bold"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {p} {isNew && "★"}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. CHRONOLOGICAL AUDIT TIMELINE                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-black/10 border border-slate-300 flex items-center justify-center text-slate-900 dark:text-slate-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Audit Timeline
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {filteredEvents.length} events
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Immutable, append-only log of every user action, parameter edit, finding, and state decision.
              </p>
            </div>
          </div>

          {/* FILTERS & SORT */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-1" />
              <button
                type="button"
                onClick={() => setFilterActor("all")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                  filterActor === "all"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterActor("technician")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                  filterActor === "technician"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                Technician
              </button>
              <button
                type="button"
                onClick={() => setFilterActor("ai")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                  filterActor === "ai"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                }`}
              >
                AI
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              className="text-xs font-mono text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-md cursor-pointer"
            >
              {sortOrder === "desc" ? "Newest First" : "Oldest First"}
            </button>
          </div>
        </div>

        {/* TIMELINE LIST */}
        <div className="mt-6 space-y-4 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredEvents.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500 font-mono">
              No audit events found for selected filter.
            </p>
          ) : (
            filteredEvents.map((evt, idx) => {
              const badge = getEventBadge(evt.type);
              const eventDate = new Date(evt.timestamp);

              return (
                <div key={idx} className="relative flex items-start gap-4 pl-1">
                  {/* Event Marker */}
                  <div className="h-9 w-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 z-10 shadow-xs">
                    {badge.icon}
                  </div>

                  {/* Event Card */}
                  <div className="flex-1 rounded-md border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        {getActorBadge(evt.actor)}
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {eventDate.toLocaleDateString()} &bull;{" "}
                        {eventDate.toLocaleTimeString()}
                      </span>
                    </div>

                    {evt.note && (
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        {evt.note}
                      </p>
                    )}

                    {/* BEFORE / AFTER HIGHLIGHTS */}
                    {(evt.before !== undefined || evt.after !== undefined) && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        {evt.before !== undefined && (
                          <div className="rounded-md bg-red-50/60 border border-red-200/80 p-2 dark:bg-red-950/20 dark:border-red-900/40">
                            <span className="text-[10px] uppercase font-bold text-red-700 dark:text-red-400 block mb-0.5">
                              Before
                            </span>
                            <pre className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-all text-[10px]">
                              {typeof evt.before === "object"
                                ? JSON.stringify(evt.before, null, 2)
                                : String(evt.before)}
                            </pre>
                          </div>
                        )}
                        {evt.after !== undefined && (
                          <div className="rounded-md bg-emerald-50/60 border border-emerald-200/80 p-2 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                              After
                            </span>
                            <pre className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all text-[10px]">
                              {typeof evt.after === "object"
                                ? JSON.stringify(evt.after, null, 2)
                                : String(evt.after)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
