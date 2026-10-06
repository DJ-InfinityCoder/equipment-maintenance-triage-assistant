"use client";

import React, { useState } from "react";
import { AiFollowUpQuestion } from "@/lib/schemas/ai-triage";
import { FollowUpAnswer } from "@/lib/schemas/triage-record";
import { Loader2, Send } from "lucide-react";

interface FollowUpAnswersPanelProps {
  questions: AiFollowUpQuestion[];
  answers: FollowUpAnswer[];
  isReadOnly: boolean;
  isSaving: boolean;
  onSubmitAnswers: (answers: Array<{ questionIndex: number; answer: string }>) => void;
}

export function FollowUpAnswersPanel({
  questions,
  answers,
  isReadOnly,
  isSaving,
  onSubmitAnswers,
}: FollowUpAnswersPanelProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedAnswers = questions.flatMap((_, questionIndex) => {
      const answer = String(formData.get(`answer-${questionIndex}`) ?? "").trim();
      return answer ? [{ questionIndex, answer }] : [];
    });
    if (submittedAnswers.length === 0) {
      setValidationError("Enter at least one answer before submitting.");
      return;
    }
    setValidationError(null);
    onSubmitAnswers(submittedAnswers);
  };

  if (questions.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic">
        No diagnostic questions are available to answer.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        The reporter or technician can answer from what they observed. Submitted
        answers are saved in the report history and used as evidence when
        refreshing AI suggestions; they are not confirmed findings.
      </p>
      {questions.map((question, index) => {
        const priorAnswer = [...answers]
          .reverse()
          .find((item) => item.question === question.question);
        return (
          <div
            key={question.question}
            className="rounded-md border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30 space-y-2"
          >
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Q{index + 1}: {question.question}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Why it matters: </span>
              {question.whyItMatters}
            </div>
            {priorAnswer && (
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Last answer by {priorAnswer.answeredBy} ({priorAnswer.answeredByRole}) at{" "}
                {new Date(priorAnswer.answeredAt).toLocaleString()}: {priorAnswer.answer}
              </p>
            )}
            <textarea
              key={`${question.question}-${priorAnswer?.answeredAt ?? "new"}`}
              name={`answer-${index}`}
              rows={2}
              maxLength={2000}
              disabled={isReadOnly || isSaving}
              defaultValue={priorAnswer?.answer ?? ""}
              placeholder="Answer from what you observed..."
              className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 disabled:opacity-60"
            />
          </div>
        );
      })}
      {validationError && (
        <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-300">
          {validationError}
        </p>
      )}
      {!isReadOnly && (
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isSaving ? "Saving answers and refreshing..." : "Save answers & refresh triage"}
        </button>
      )}
    </form>
  );
}
