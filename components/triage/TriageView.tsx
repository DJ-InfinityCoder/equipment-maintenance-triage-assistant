"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { Citation } from "@/lib/schemas/citation";
import { ConfirmedFinding, TechnicianEdits } from "@/lib/schemas/work-order";
import { EvidencePanel } from "./EvidencePanel";
import { WorkOrderPanel } from "./WorkOrderPanel";
import { CitationModal } from "./CitationModal";
import { AuditTrailPanel } from "./AuditTrailPanel";
import type { UserRole } from "@/lib/schemas/user";
import {
  Wrench,
  ArrowLeft,
  Layers,
  History,
  Clock,
} from "lucide-react";

interface TriageViewProps {
  initialRecord: TriageRecord;
  userRole: UserRole;
  userName: string;
}

export function TriageView({ initialRecord, userRole, userName }: TriageViewProps) {
  const [record, setRecord] = useState<TriageRecord>(initialRecord);
  const [activeTab, setActiveTab] = useState<"evidence" | "audit">("evidence");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [confirmedFindings, setConfirmedFindings] = useState<ConfirmedFinding[]>(
    initialRecord.confirmedFindings || []
  );
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingAnswers, setIsSavingAnswers] = useState(false);

  const isReadOnly =
    record.workOrder.status === "approved" || record.workOrder.status === "rejected";

  // -------------------------------------------------------------------------
  // 1. STEP TOGGLE WITH OPTIMISTIC UI & AUDIT EVENT (PATCH /api/work-orders/[id])
  // -------------------------------------------------------------------------
  const handleToggleStep = async (stepNumber: number) => {
    const nextState = !checkedSteps[stepNumber];
    setCheckedSteps((prev) => ({
      ...prev,
      [stepNumber]: nextState,
    }));

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepCompletion: {
            stepNumber,
            completed: nextState,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log inspection step completion.");
      }

      if (data.record) {
        setRecord(data.record);
      }
    } catch (err) {
      // Revert optimistic update
      setCheckedSteps((prev) => ({
        ...prev,
        [stepNumber]: !nextState,
      }));
      toast.error(
        `Failed to record step status: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleSubmitFollowUpAnswers = async (
    answers: Array<{ questionIndex: number; answer: string }>
  ) => {
    setIsSavingAnswers(true);
    const toastId = toast.loading("Saving diagnostic answers and refreshing triage...");
    try {
      const response = await fetch(`/api/triage/${record.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not save follow-up answers.");
      }
      setRecord(result.record as TriageRecord);
      if (result.aiRefreshed) {
        toast.success("Answers saved. AI observations and the draft work order were refreshed.", {
          id: toastId,
        });
      } else {
        toast.warning(result.message || "Answers were saved, but AI triage could not be refreshed.", {
          id: toastId,
          duration: 8000,
        });
      }
    } catch (error) {
      toast.error(
        `Could not submit answers: ${error instanceof Error ? error.message : String(error)}`,
        { id: toastId, duration: 7000 }
      );
    } finally {
      setIsSavingAnswers(false);
    }
  };

  // -------------------------------------------------------------------------
  // 3. CONFIRMED FINDINGS (Strictly Human Technician - Rule 4)
  // -------------------------------------------------------------------------
  const handleAddConfirmedFinding = async (finding: ConfirmedFinding) => {
    // Optimistic UI update
    const previousFindings = [...confirmedFindings];
    const newFindings = [...previousFindings, finding];
    setConfirmedFindings(newFindings);

    const toastId = toast.loading("Saving technician confirmed finding...");

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newFinding: finding,
          confirmedFindings: newFindings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record confirmed finding.");
      }

      if (data.record) {
        setRecord(data.record);
      }
      toast.success("Confirmed finding recorded into dossier & audit trail", {
        id: toastId,
      });
    } catch (err) {
      // Rollback on failure to prevent silent data loss
      setConfirmedFindings(previousFindings);
      toast.error(
        `Could not save finding: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId }
      );
    }
  };

  const handleRemoveConfirmedFinding = async (index: number) => {
    const previousFindings = [...confirmedFindings];
    const newFindings = previousFindings.filter((_, idx) => idx !== index);
    setConfirmedFindings(newFindings);

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmedFindings: newFindings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove confirmed finding.");
      }

      if (data.record) {
        setRecord(data.record);
      }
      toast.success("Finding removed.");
    } catch (err) {
      setConfirmedFindings(previousFindings);
      toast.error(
        `Failed to delete finding: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  // -------------------------------------------------------------------------
  // 4. SAVE DRAFT (PATCH /api/work-orders/[id]) - Rule 2 & 3
  // -------------------------------------------------------------------------
  const handleSaveDraft = async (edits: TechnicianEdits) => {
    setIsProcessing(true);
    const toastId = toast.loading("Saving work order edits...");

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: edits.editedTitle,
          description: edits.editedDescription,
          finalPriority: edits.editedPriority,
          recommendedActions: edits.customActions,
          partsToCheck: edits.customPartsToCheck,
          technicianEdits: edits,
          downgradeJustification: edits.technicianNotes,
          ...(userRole === "technician" ? { confirmedFindings } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            `Server returned HTTP ${res.status}: Failed to save work order.`
        );
      }

      setRecord((prev) => ({
        ...prev,
        ...(data.record || {}),
        workOrder: data.workOrder,
      }));

      toast.success("Draft work order updated & changes logged in audit trail", {
        id: toastId,
      });
    } catch (err) {
      toast.error(
        `Draft save failed: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId, duration: 6000 }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // 5. APPROVE WORK ORDER (POST /api/work-orders/[id]/approve) - Rule 1 & 2
  // -------------------------------------------------------------------------
  const handleApprove = async (technicianName: string, edits: TechnicianEdits) => {
    setIsProcessing(true);
    const toastId = toast.loading("Authorizing and approving work order...");

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianName,
          title: edits.editedTitle,
          description: edits.editedDescription,
          finalPriority: edits.editedPriority,
          recommendedActions: edits.customActions,
          partsToCheck: edits.customPartsToCheck,
          justification: edits.technicianNotes,
          technicianEdits: edits,
          ...(userRole === "technician" ? { confirmedFindings } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            "State conflict (409): Work order has already been finalized and cannot be modified."
          );
        }
        throw new Error(
          data.error ||
            `Approval rejected by server (HTTP ${res.status}).`
        );
      }

      setRecord((prev) => ({
        ...prev,
        ...(data.record || {}),
        workOrder: data.workOrder,
      }));

      toast.success(
        `Work order successfully approved & authorized by ${technicianName}! Record finalized.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err) {
      toast.error(
        `Approval failed: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId, duration: 7000 }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // 6. REJECT WORK ORDER (POST /api/work-orders/[id]/reject) - Rule 2
  // -------------------------------------------------------------------------
  const handleReject = async (
    technicianName: string,
    reason: string,
    edits: TechnicianEdits
  ) => {
    setIsProcessing(true);
    const toastId = toast.loading("Rejecting work order...");

    try {
      const res = await fetch(`/api/work-orders/${record.workOrder.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianName,
          rejectionReason: reason,
          technicianEdits: edits,
          ...(userRole === "technician" ? { confirmedFindings } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(
            "State conflict (409): Work order has already been finalized and cannot be modified."
          );
        }
        throw new Error(data.error || "Failed to reject work order.");
      }

      setRecord((prev) => ({
        ...prev,
        ...(data.record || {}),
        workOrder: data.workOrder,
      }));

      toast.success(
        `Work order rejected by ${technicianName}. Rejection logged in audit trail.`,
        { id: toastId, duration: 5000 }
      );
    } catch (err) {
      toast.error(
        `Rejection failed: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId, duration: 7000 }
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // 7. RETRY TRIAGE
  // -------------------------------------------------------------------------
  const handleRetryTriage = async () => {
    setIsRetrying(true);
    const toastId = toast.loading("Re-running triage pipeline with manuals...");

    try {
      const res = await fetch(`/api/triage/${record.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Retry triage attempt failed.");
      }

      const updatedRecord = data.record as TriageRecord;
      setRecord(updatedRecord);

      if (updatedRecord.ai?.status === "ok") {
        toast.success(
          "AI triage completed. Manuals and recommendations were refreshed.",
          { id: toastId }
        );
      } else if (updatedRecord.retrieval?.status === "failed") {
        toast.error(
          `Retry completed, but manual retrieval failed: ${updatedRecord.retrieval.error || "Please try again."} Deterministic safety rules remain enforced.`,
          { id: toastId, duration: 8000 }
        );
      } else if (updatedRecord.ai?.status === "failed") {
        toast.error(
          `Retry completed, but AI triage is still unavailable: ${updatedRecord.ai.error || "Please try again shortly."} Deterministic safety rules remain enforced.`,
          { id: toastId, duration: 8000 }
        );
      } else {
        toast.error(
          "Retry completed, but no matching manual sections were found. AI triage was skipped; deterministic safety rules remain enforced.",
          { id: toastId, duration: 8000 }
        );
      }
    } catch (err) {
      toast.error(
        `Retry triage failed: ${err instanceof Error ? err.message : String(err)}`,
        { id: toastId }
      );
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Banner & Header */}
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href={userRole === "reporter" ? "/my-reports" : "/dashboard"}
              className="p-2 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 cursor-pointer"
              title="Return to report form"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-slate-900 dark:text-slate-700" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Triage Dossier: {record.issueReport.equipmentId}
                </h1>
                <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-300">
                  {record.issueReport.equipmentType.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Record ID: <span className="font-mono">{record.id}</span> &bull; Work Order ID: <span className="font-mono">{record.workOrder.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {record.workOrder.status === "draft" && (
              <Link
                href={
                  userRole === "reporter"
                    ? `/my-reports/${encodeURIComponent(record.id)}/edit`
                    : `/triage/${encodeURIComponent(record.id)}/edit`
                }
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Edit report
              </Link>
            )}
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Rule Floor Priority
              </span>
              <span className="text-xs font-mono font-extrabold uppercase text-slate-800 dark:text-slate-200">
                {record.ruleFloorPriority}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Final Priority
              </span>
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                  record.finalPriority === "critical"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    : record.finalPriority === "high"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-slate-100 text-slate-900 dark:bg-black dark:text-slate-600"
                }`}
              >
                {record.finalPriority}
              </span>
            </div>
          </div>
        </header>

        {/* TWO-COLUMN LAYOUT WITH TABS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: TABS (Evidence Dossier vs Audit Trail & Diff) (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* TAB SELECTOR */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("evidence")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "evidence"
                    ? "bg-black text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                }`}
              >
                <Layers className="h-4 w-4" />
                Evidence & Diagnostics
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-black text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                }`}
              >
                <History className="h-4 w-4" />
                Audit Trail & Diff
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                    activeTab === "audit"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {record.auditTrail?.length || 0}
                </span>
              </button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === "evidence" ? (
              <EvidencePanel
                record={record}
                onCitationClick={(c) => setActiveCitation(c)}
                onRetryTriage={handleRetryTriage}
                isRetrying={isRetrying}
                confirmedFindings={confirmedFindings}
                onAddConfirmedFinding={handleAddConfirmedFinding}
                onRemoveConfirmedFinding={handleRemoveConfirmedFinding}
                checkedInspectionSteps={checkedSteps}
                onToggleInspectionStep={handleToggleStep}
                isSavingAnswers={isSavingAnswers}
                onSubmitFollowUpAnswers={handleSubmitFollowUpAnswers}
                isReadOnly={isReadOnly}
                canManageFindings={userRole === "technician"}
              />
            ) : (
              <AuditTrailPanel record={record} workOrder={record.workOrder} />
            )}
          </div>

          {/* RIGHT COLUMN: WORK ORDER & DECISION PANEL (5 cols) */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
            <WorkOrderPanel
              key={`${record.workOrder.id}:${record.workOrder.updatedAt}`}
              workOrder={record.workOrder}
              ruleFloor={record.ruleFloorPriority}
              userRole={userRole}
              userName={userName}
              onSaveDraft={handleSaveDraft}
              onApprove={handleApprove}
              onReject={handleReject}
              isProcessing={isProcessing}
            />

            {/* Mini Audit summary card */}
            <div className="rounded-md border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span>Audit Trail Highlights</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("audit")}
                  className="text-[11px] text-slate-900 dark:text-slate-700 hover:underline cursor-pointer"
                >
                  View Diff & Timeline &rarr;
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-slate-500 max-h-32 overflow-y-auto">
                {(record.auditTrail || []).slice(-4).reverse().map((e, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span className="truncate">{e.type} ({e.actor})</span>
                    <span className="text-[10px] opacity-70 shrink-0">{e.timestamp.slice(11, 19)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CITATION MODAL DIALOG */}
      <CitationModal
        citation={activeCitation}
        record={record}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}
