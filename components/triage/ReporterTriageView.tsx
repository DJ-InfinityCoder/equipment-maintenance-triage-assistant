"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TriageRecord } from "@/lib/schemas/triage-record";
import { FollowUpAnswersPanel } from "./FollowUpAnswersPanel";
import { ArrowLeft, ClipboardList, Wrench } from "lucide-react";

export function ReporterTriageView({ initialRecord }: { initialRecord: TriageRecord }) {
  const [record, setRecord] = useState(initialRecord);
  const [isSaving, setIsSaving] = useState(false);
  const isReadOnly = record.workOrder.status !== "draft";

  const handleSubmitAnswers = async (
    answers: Array<{ questionIndex: number; answer: string }>
  ) => {
    setIsSaving(true);
    const toastId = toast.loading("Saving your answers and updating triage...");
    try {
      const response = await fetch(`/api/triage/${record.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save your answers.");
      }
      setRecord(result.record as TriageRecord);
      if (result.aiRefreshed) {
        toast.success("Your answers were saved and AI suggestions were refreshed for technician review.", {
          id: toastId,
        });
      } else {
        toast.warning(result.message || "Your answers were saved, but AI suggestions could not be refreshed.", {
          id: toastId,
          duration: 8000,
        });
      }
    } catch (error) {
      toast.error(
        `Could not save your answers: ${error instanceof Error ? error.message : String(error)}`,
        { id: toastId, duration: 7000 }
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/my-reports"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            My Reports
          </Link>
          {record.workOrder.status === "draft" &&
            !record.auditTrail.some((item) => item.actor === "technician") && (
              <Link
                href={`/my-reports/${encodeURIComponent(record.id)}/edit`}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Edit report
              </Link>
            )}
        </div>
        <header className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Wrench className="h-5 w-5" />
            <div>
              <h1 className="text-xl font-bold">
                Report follow-up: {record.issueReport.equipmentId}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reference: <span className="font-mono">{record.id}</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
            {record.issueReport.issueDescription}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Safety rule floor: {record.ruleFloorPriority.toUpperCase()}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Work order: {record.workOrder.status}
            </span>
          </div>
        </header>

        <section className="space-y-4 rounded-md border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-amber-100 pb-3 dark:border-amber-900/50">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            <h2 className="font-bold">Questions from the triage assistant</h2>
          </div>
          <FollowUpAnswersPanel
            questions={record.aiTriage?.followUpQuestions ?? []}
            answers={record.followUpAnswers ?? []}
            isReadOnly={isReadOnly}
            isSaving={isSaving}
            onSubmitAnswers={handleSubmitAnswers}
          />
          {record.aiTriage?.followUpQuestions.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No follow-up questions were generated for this report. The report
              and its safety checks have been saved for technician review.
            </p>
          )}
          {(record.ai?.status === "failed" ||
            record.ai?.status === "skipped_no_context") && (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              AI follow-up questions are unavailable for this report
              {record.ai.error ? `: ${record.ai.error}` : " because no verified manual context was available"}.
              The deterministic safety checks remain in effect, and a technician
              will review the saved report.
            </p>
          )}
          {record.ai?.status === "failed" && record.ai.error && (
            <p
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              Your answers were saved, but AI suggestions could not be refreshed:
              {" "}{record.ai.error} The existing draft and deterministic safety priority remain in effect.
            </p>
          )}
          {isReadOnly && (
            <p className="text-xs text-slate-500">
              This work order is finalized. Contact a technician if additional observations need to be recorded.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
