"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IssueReportInput } from "@/lib/schemas/issue-report";
import { BASE_EQUIPMENT_TYPES, EQUIPMENT_LABELS } from "@/lib/schemas/equipment";
import { ArrowLeft, Loader2, Save, Trash2, Plus } from "lucide-react";

interface ReporterReportEditorProps {
  triageId: string;
  initialReport: IssueReportInput;
  backHref?: string;
}

export function ReporterReportEditor({
  triageId,
  initialReport,
  backHref = "/my-reports",
}: ReporterReportEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<IssueReportInput>(initialReport);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof IssueReportInput>(
    key: K,
    value: IssueReportInput[K]
  ) => setForm((current) => ({ ...current, [key]: value }));

  const updateEvent = (index: number, description: string) => {
    setForm((current) => ({
      ...current,
      recentEvents: current.recentEvents.map((event, eventIndex) =>
        eventIndex === index ? { ...event, description } : event
      ),
    }));
  };

  const addEvent = () => {
    setForm((current) => ({
      ...current,
      recentEvents: [...current.recentEvents, { description: "" }],
    }));
  };

  const removeEvent = (index: number) => {
    setForm((current) => ({
      ...current,
      recentEvents:
        current.recentEvents.length > 1
          ? current.recentEvents.filter((_, eventIndex) => eventIndex !== index)
          : current.recentEvents,
    }));
  };

  const updateSensor = (
    index: number,
    field: "key" | "value" | "unit",
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      sensorReadings: (current.sensorReadings ?? []).map((sensor, sensorIndex) =>
        sensorIndex === index
          ? { ...sensor, [field]: field === "value" ? Number(value) : value }
          : sensor
      ),
    }));
  };

  const addSensor = () => {
    setForm((current) => ({
      ...current,
      sensorReadings: [
        ...(current.sensorReadings ?? []),
        { key: "", value: 0, unit: "" },
      ],
    }));
  };

  const removeSensor = (index: number) => {
    setForm((current) => ({
      ...current,
      sensorReadings: (current.sensorReadings ?? []).filter(
        (_, sensorIndex) => sensorIndex !== index
      ),
    }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/triage/${encodeURIComponent(triageId)}/report`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.userMessage || result.error || "Could not update report.");
      }
      router.push(`/triage/${encodeURIComponent(triageId)}?updated=1`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update report.");
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const labelClass =
    "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {backHref === "/my-reports" ? "Back to My Reports" : "Back to Triage"}
        </Link>
        <header>
          <h1 className="text-2xl font-bold">Edit equipment report</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Saving reruns safety checks, manual retrieval, and AI triage. Previous
            report versions remain in the audit history. Finalized reports cannot
            be edited.
          </p>
        </header>

        <form
          onSubmit={handleSave}
          className="space-y-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <label className={labelClass} htmlFor="edit-equipment-type">Equipment type</label>
            <select
              id="edit-equipment-type"
              value={form.equipmentType}
              onChange={(event) =>
                updateField(
                  "equipmentType",
                  event.target.value as IssueReportInput["equipmentType"]
                )
              }
              className={fieldClass}
            >
              {BASE_EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>{EQUIPMENT_LABELS[type]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="edit-equipment-id">Equipment ID</label>
            <input
              id="edit-equipment-id"
              required
              maxLength={50}
              value={form.equipmentId}
              onChange={(event) => updateField("equipmentId", event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="edit-issue">Issue description</label>
            <textarea
              id="edit-issue"
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              value={form.issueDescription}
              onChange={(event) => updateField("issueDescription", event.target.value)}
              className={fieldClass}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className={labelClass}>Recent operating events</legend>
            {form.recentEvents.map((event, index) => (
              <div key={index} className="flex items-start gap-2">
                <textarea
                  required
                  maxLength={1000}
                  rows={2}
                  aria-label={`Operating event ${index + 1}`}
                  value={event.description}
                  onChange={(e) => updateEvent(index, e.target.value)}
                  className={fieldClass}
                />
                <button
                  type="button"
                  aria-label={`Remove operating event ${index + 1}`}
                  disabled={form.recentEvents.length <= 1}
                  onClick={() => removeEvent(index)}
                  className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addEvent}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:underline dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add event
            </button>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className={labelClass}>Optional sensor readings</legend>
            {(form.sensorReadings ?? []).map((sensor, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    aria-label={`Sensor ${index + 1} key`}
                    placeholder="Sensor key"
                    value={sensor.key}
                    onChange={(e) => updateSensor(index, "key", e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    aria-label={`Sensor ${index + 1} value`}
                    type="number"
                    step="any"
                    value={sensor.value}
                    onChange={(e) => updateSensor(index, "value", e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    aria-label={`Sensor ${index + 1} unit`}
                    placeholder="Unit"
                    value={sensor.unit}
                    onChange={(e) => updateSensor(index, "unit", e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove sensor reading ${index + 1}`}
                  onClick={() => removeSensor(index)}
                  className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSensor}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:underline dark:text-slate-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add sensor reading
            </button>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
          <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Rechecking report..." : "Save changes & rerun triage"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
