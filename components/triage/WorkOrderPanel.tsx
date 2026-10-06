"use client";

import React, { useState } from "react";
import { WorkOrder, TechnicianEdits } from "@/lib/schemas/work-order";
import { PriorityLevel, PRIORITY_LEVELS, PRIORITY_RANK } from "@/lib/schemas/priority";
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Plus,
  Trash2,
  Lock,
  UserCheck,
} from "lucide-react";

interface WorkOrderPanelProps {
  workOrder: WorkOrder;
  ruleFloor: PriorityLevel;
  userRole: "reporter" | "technician";
  userName: string;
  onSaveDraft: (edits: TechnicianEdits) => Promise<void>;
  onApprove: (technicianName: string, edits: TechnicianEdits) => Promise<void>;
  onReject: (technicianName: string, reason: string, edits: TechnicianEdits) => Promise<void>;
  isProcessing: boolean;
}

export function WorkOrderPanel({
  workOrder,
  ruleFloor,
  userRole,
  userName,
  onSaveDraft,
  onApprove,
  onReject,
  isProcessing,
}: WorkOrderPanelProps) {
  // Local state for editable fields
  const [title, setTitle] = useState(workOrder.title);
  const [description, setDescription] = useState(workOrder.description);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel>(
    workOrder.finalPriority
  );
  const [actions, setActions] = useState<string[]>(
    workOrder.recommendedActions || []
  );
  const [newActionText, setNewActionText] = useState("");
  const [parts, setParts] = useState<string[]>(workOrder.partsToCheck || []);
  const [newPartText, setNewPartText] = useState("");
  const [downgradeJustification, setDowngradeJustification] = useState("");

  // Dialog states
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [technicianName, setTechnicianName] = useState(
    workOrder.approvedBy || userName
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const isDecided = workOrder.status === "approved" || workOrder.status === "rejected";

  // Check if priority is downgraded below rule floor
  const isBelowFloor =
    PRIORITY_RANK[selectedPriority] < PRIORITY_RANK[ruleFloor];

  const getEdits = (): TechnicianEdits => ({
    editedTitle: title,
    editedDescription: description,
    editedPriority: selectedPriority,
    customActions: actions,
    customPartsToCheck: parts,
    technicianNotes: isBelowFloor ? downgradeJustification : undefined,
  });

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;
    setActions([...actions, newActionText.trim()]);
    setNewActionText("");
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, idx) => idx !== index));
  };

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartText.trim()) return;
    setParts([...parts, newPartText.trim()]);
    setNewPartText("");
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, idx) => idx !== index));
  };

  // Rule 1: Approving requires technician name, non-empty title and description, and final priority >= rule floor OR justification string
  const canSubmitDecision =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    (!isBelowFloor || downgradeJustification.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* WORK ORDER STATUS / DECISION SUMMARY BANNER                       */}
      {/* ------------------------------------------------------------------ */}
      {workOrder.status === "approved" && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 space-y-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">
              Work Order Approved & Released
            </h3>
          </div>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Formally approved by technician <span className="font-semibold">{workOrder.approvedBy}</span> on {workOrder.decidedAt}. Record is now finalized and read-only.
          </p>
        </div>
      )}

      {workOrder.status === "rejected" && (
        <div className="rounded-md border border-red-300 bg-red-50/90 p-5 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 space-y-2">
          <div className="flex items-center gap-2.5">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-red-900 dark:text-red-100 text-sm">
              Work Order Rejected
            </h3>
          </div>
          <p className="text-xs text-red-800 dark:text-red-300">
            Decision recorded on {workOrder.decidedAt}. Reason: &ldquo;{workOrder.rejectionReason}&rdquo;
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MAIN WORK ORDER FORM CONTAINER                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-md border border-slate-200 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-slate-900 dark:text-slate-700" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Work Order Decision Panel
            </h2>
          </div>
          <span
            className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              workOrder.status === "approved"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300"
                : workOrder.status === "rejected"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border border-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300"
            }`}
          >
            Status: {workOrder.status}
          </span>
        </div>

        {/* Priority Selector & Safety Floor Warning */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Assigned Priority
            </label>
            <span className="text-xs text-slate-500 font-mono">
              Rule Floor: <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{ruleFloor}</span>
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRIORITY_LEVELS.map((lvl) => {
              const isSelected = selectedPriority === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  disabled={isDecided || isProcessing}
                  onClick={() => setSelectedPriority(lvl)}
                  className={`py-2 px-2.5 rounded-md text-xs font-bold uppercase tracking-wider border text-center transition-all cursor-pointer disabled:cursor-not-allowed ${
                    isSelected
                      ? lvl === "critical"
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : lvl === "high"
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : lvl === "medium"
                        ? "bg-yellow-500 text-white border-yellow-500 shadow-sm"
                        : "bg-black text-white border-slate-300 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Warning on Down-prioritizing below rule floor */}
          {isBelowFloor && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Safety Rule Floor Warning: </span>
                  Selected priority ({selectedPriority.toUpperCase()}) is lower than the calculated physical rule floor ({ruleFloor.toUpperCase()}).
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300 mb-1">
                  Mandatory Written Justification (Min 10 characters):
                </label>
                <textarea
                  rows={2}
                  disabled={isDecided || isProcessing}
                  placeholder="Explain why equipment risk can be safely downgraded below the deterministic limit..."
                  value={downgradeJustification}
                  onChange={(e) => setDowngradeJustification(e.target.value)}
                  className="w-full rounded-md border border-red-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-red-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Work Order Title */}
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Work Order Title
          </label>
          <input
            type="text"
            disabled={isDecided || isProcessing}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
          />
        </div>

        {/* Work Order Description */}
        <div className="space-y-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Scope & Instructions
          </label>
          <textarea
            rows={3}
            disabled={isDecided || isProcessing}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-900 shadow-xs focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 disabled:opacity-60"
          />
        </div>

        {/* Recommended Actions */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Recommended Corrective Actions ({actions.length})
          </label>
          <div className="space-y-1.5">
            {actions.map((act, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
              >
                <span>&bull; {act}</span>
                {!isDecided && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAction(idx)}
                    className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isDecided && (
            <form onSubmit={handleAddAction} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add custom action step..."
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!newActionText.trim()}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Parts to Check */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Parts & Components to Inspect ({parts.length})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {parts.map((part, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              >
                {part}
                {!isDecided && (
                  <button
                    type="button"
                    onClick={() => handleRemovePart(idx)}
                    className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {!isDecided && (
            <form onSubmit={handleAddPart} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add component/part to check..."
                value={newPartText}
                onChange={(e) => setNewPartText(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!newPartText.trim()}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* DECISION ACTION BUTTONS (DISABLED AFTER DECISION)                   */}
        {/* ------------------------------------------------------------------ */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            {!isDecided && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onSaveDraft(getEdits())}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save Draft Edits
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isDecided ? (
              <>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowRejectDialog(true)}
                  className="rounded-md border border-red-300 bg-white px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 cursor-pointer disabled:opacity-50"
                >
                  Reject Work Order
                </button>

                {userRole === "technician" && (
                  <button
                    type="button"
                    disabled={isProcessing || !canSubmitDecision}
                    onClick={() => setShowApproveDialog(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <UserCheck className="h-4 w-4" />
                    Approve Work Order
                  </button>
                )}
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Lock className="h-3.5 w-3.5" />
                Actions locked following technician decision
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* APPROVE CONFIRMATION DIALOG MODAL                                  */}
      {/* ------------------------------------------------------------------ */}
      {showApproveDialog && userRole === "technician" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Confirm Work Order Approval
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Non-negotiable Rule 2: AI triage proposals require explicit human technician authorization before dispatch. Please record your name or badge number.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Approving Technician Name or Badge # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Technician Dave Miller #842"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveDialog(false)}
                className="rounded-md px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!technicianName.trim() || isProcessing}
                onClick={() => {
                  setShowApproveDialog(false);
                  onApprove(technicianName, getEdits());
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                Authorize & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* REJECT DIALOG MODAL                                                */}
      {/* ------------------------------------------------------------------ */}
      {showRejectDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reject Work Order
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Please document why this draft should be rejected (for example, a duplicate request or resolved symptom).
            </p>

            {userRole === "technician" && <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Technician Name or Badge # <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Technician Dave Miller #842"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Specify reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectDialog(false)}
                className="rounded-md px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!technicianName.trim() || !rejectionReason.trim() || isProcessing}
                onClick={() => {
                  setShowRejectDialog(false);
                  onReject(technicianName, rejectionReason, getEdits());
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
