"use client";

import React from "react";
import {
  UseFormRegister,
  Control,
  useFieldArray,
  UseFormWatch,
  UseFormSetValue,
} from "react-hook-form";
import { IssueReportInput } from "@/lib/schemas/issue-report";
import { EquipmentType } from "@/lib/schemas/equipment";
import { EQUIPMENT_SENSOR_LIMITS } from "@/lib/rules/limits";
import { Plus, Trash2, Info, Sparkles, AlertCircle } from "lucide-react";

interface SensorReadingsStepProps {
  register: UseFormRegister<IssueReportInput>;
  control: Control<IssueReportInput>;
  watch: UseFormWatch<IssueReportInput>;
  setValue: UseFormSetValue<IssueReportInput>;
}

export function SensorReadingsStep({
  register,
  control,
  watch,
  setValue,
}: SensorReadingsStepProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "sensorReadings",
  });

  const equipmentType = watch("equipmentType") as EquipmentType;
  const standardLimits = EQUIPMENT_SENSOR_LIMITS[equipmentType] || [];

  const handleSelectSuggestedKey = (index: number, selectedKey: string) => {
    const limit = standardLimits.find((l) => l.sensorKey === selectedKey);
    setValue(`sensorReadings.${index}.key` as const, selectedKey);
    if (limit) {
      setValue(`sensorReadings.${index}.unit` as const, limit.unit);
    }
  };

  const handleAddAllStandardSensors = () => {
    for (const limit of standardLimits) {
      // Check if already in fields
      const currentReadings = watch("sensorReadings") || [];
      const exists = currentReadings.some((r) => r.key === limit.sensorKey);
      if (!exists) {
        append({
          key: limit.sensorKey,
          value: limit.normalMax ?? 0,
          unit: limit.unit,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Step 3: Sensor Readings & Telemetry (Optional)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Attach measured physical telemetry (pressures, temperatures, vibration, currents) to enable deterministic threshold evaluation.
        </p>
      </div>

      {/* Info notice about optional telemetry */}
      <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-100 p-3.5 text-sm text-slate-900 dark:border-slate-300 dark:bg-black/30 dark:text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-900 dark:text-slate-700" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-600">
            Telemetry is optional:
          </span>{" "}
          Submitting without sensor readings is permitted. Triage will proceed based on narrative symptoms and events, though diagnostic confidence will be lower.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Active Sensor Readings ({fields.length})
        </div>
        <div className="flex items-center gap-2">
          {standardLimits.length > 0 && (
            <button
              type="button"
              onClick={handleAddAllStandardSensors}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-300 dark:bg-black/60 dark:text-slate-600 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Add All Standard Sensors
            </button>
          )}
          <button
            type="button"
            onClick={() => append({ key: "", value: 0, unit: "" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-300 dark:bg-black/60 dark:text-slate-600 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sensor
          </button>
        </div>
      </div>

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-400" />
          <h4 className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            No sensor readings added
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You can proceed to review and submit with narrative only, or click below to attach standard sensors.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => append({ key: "", value: 0, unit: "" })}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Sensor
            </button>
            {standardLimits.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllStandardSensors}
                className="inline-flex items-center gap-1.5 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Add Standard {equipmentType.replace(/_/g, " ")} Sensors
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sensor Rows */}
      <div className="space-y-3">
        {fields.map((field, index) => {
          const currentKey = watch(`sensorReadings.${index}.key`);
          const matchedLimit = standardLimits.find((l) => l.sensorKey === currentKey);

          return (
            <div
              key={field.id}
              className="rounded-md border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                {/* Sensor Key & Quick Suggestion */}
                <div className="sm:col-span-5 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sensor Metric
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      list={`sensor-suggestions-${index}`}
                      placeholder="e.g. bearing_temp_c, discharge_pressure_psi"
                      {...register(`sensorReadings.${index}.key` as const, {
                        required: "Sensor key is required",
                      })}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                    <datalist id={`sensor-suggestions-${index}`}>
                      {standardLimits.map((limit) => (
                        <option key={limit.sensorKey} value={limit.sensorKey}>
                          {limit.name} ({limit.unit})
                        </option>
                      ))}
                    </datalist>
                  </div>
                  {/* Quick Select Pill */}
                  {standardLimits.length > 0 && !matchedLimit && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {standardLimits.slice(0, 3).map((l) => (
                        <button
                          key={l.sensorKey}
                          type="button"
                          onClick={() => handleSelectSuggestedKey(index, l.sensorKey)}
                          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-600 cursor-pointer"
                        >
                          +{l.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Measured Value */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Measured Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.0"
                    {...register(`sensorReadings.${index}.value` as const, {
                      valueAsNumber: true,
                    })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Unit */}
                <div className="sm:col-span-3 space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. celsius, psi, mm/s"
                    {...register(`sensorReadings.${index}.unit` as const, {
                      required: "Unit is required",
                    })}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Remove Row */}
                <div className="sm:col-span-1 pt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    title="Remove reading"
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sensor limit hints */}
              {matchedLimit && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 pt-2 dark:border-slate-800/60 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Normal range: {matchedLimit.normalMin ?? "0"} - {matchedLimit.normalMax} {matchedLimit.unit}
                  </span>
                  {matchedLimit.warningHigh && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      Warning: &ge;{matchedLimit.warningHigh} {matchedLimit.unit}
                    </span>
                  )}
                  {matchedLimit.criticalHigh && (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Critical: &ge;{matchedLimit.criticalHigh} {matchedLimit.unit}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
