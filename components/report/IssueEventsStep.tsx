"use client";

import React from "react";
import {
  Controller,
  UseFormRegister,
  FieldErrors,
  Control,
  useFieldArray,
  UseFormWatch,
  UseFormSetValue,
} from "react-hook-form";
import { IssueReportInput } from "@/lib/schemas/issue-report";
import { Plus, Trash2, FileQuestion } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface IssueEventsStepProps {
  register: UseFormRegister<IssueReportInput>;
  errors: FieldErrors<IssueReportInput>;
  control: Control<IssueReportInput>;
  watch: UseFormWatch<IssueReportInput>;
  setValue: UseFormSetValue<IssueReportInput>;
}

export function IssueEventsStep({
  register,
  errors,
  control,
  watch,
  setValue,
}: IssueEventsStepProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "recentEvents",
  });

  const descriptionValue = watch("issueDescription") || "";
  const charCount = descriptionValue.length;

  const handleQuickAddNone = () => {
    if (fields.length === 1 && !fields[0].description) {
      setValue("recentEvents.0.description", "None reported");
    } else {
      append({ description: "None reported" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Step 2: Issue Description & Operating Events
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Provide a narrative description of observed symptoms and recent operational changes.
        </p>
      </div>

      {/* Issue Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="issueDescription"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Issue Description <span className="text-red-500">*</span>
          </label>
          <span
            className={`text-xs font-mono font-medium ${
              charCount < 10
                ? "text-amber-600 dark:text-amber-400"
                : charCount > 2000
                ? "text-red-600 dark:text-red-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {charCount}/2000 chars {charCount < 10 && "(min 10 required)"}
          </span>
        </div>
        <textarea
          id="issueDescription"
          rows={4}
          placeholder="Describe observed physical symptoms (e.g. grinding noise, fluid leakage, motor overheating, vibration, belt slip, smoke, or tripped breakers)..."
          maxLength={2000}
          {...register("issueDescription")}
          className="w-full rounded-md border border-slate-300 bg-white p-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {errors.issueDescription && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {errors.issueDescription.message}
          </p>
        )}
      </div>

      {/* Recent Operating Events List */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              Recent Operating Events <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Events preceding the fault (e.g., startup, lube service, load spike, power blip).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickAddNone}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
            >
              <FileQuestion className="h-3.5 w-3.5" />
              Quick: &quot;None reported&quot;
            </button>
            <button
              type="button"
              onClick={() => append({ description: "" })}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-300 dark:bg-black/60 dark:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Event
            </button>
          </div>
        </div>

        {errors.recentEvents?.message && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {errors.recentEvents.message}
          </p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2.5 rounded-md border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300 self-start mt-1">
                {index + 1}
              </span>

              {/* Event Description */}
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  placeholder="e.g. Pump restarted after batch cycle change; operator noted drip"
                  {...register(`recentEvents.${index}.description` as const)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {errors.recentEvents?.[index]?.description && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.recentEvents[index]?.description?.message}
                  </p>
                )}
              </div>

              {/* Optional Timestamp */}
              <div className="w-full sm:w-56 space-y-1">
                <Controller
                  control={control}
                  name={`recentEvents.${index}.occurredAt` as const}
                  render={({ field }) => (
                    <DateTimePicker
                      id={`recent-event-${index}-occurred-at`}
                      name={field.name}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                    />
                  )}
                />
              </div>

              {/* Delete Button */}
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  title="Remove event"
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors self-end sm:self-center cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
