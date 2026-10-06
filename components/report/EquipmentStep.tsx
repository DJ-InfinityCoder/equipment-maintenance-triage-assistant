"use client";

import React from "react";
import { Controller, Control, UseFormRegister, FieldErrors, UseFormWatch } from "react-hook-form";
import { IssueReportInput } from "@/lib/schemas/issue-report";
import { BASE_EQUIPMENT_TYPES, EquipmentType } from "@/lib/schemas/equipment";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EquipmentStepProps {
  control: Control<IssueReportInput>;
  register: UseFormRegister<IssueReportInput>;
  errors: FieldErrors<IssueReportInput>;
  watch: UseFormWatch<IssueReportInput>;
}

const EQUIPMENT_LABELS: Record<EquipmentType, { name: string; desc: string }> = {
  centrifugal_pump: {
    name: "Centrifugal Pump",
    desc: "Single/multi-stage fluid pumps with mechanical seals and bearing frames.",
  },
  air_compressor: {
    name: "Air Compressor",
    desc: "Rotary screw compressors with lube circuits, airend, and pressure vessels.",
  },
  hvac_chiller: {
    name: "HVAC Chiller",
    desc: "Vapor-compression chillers with shell/tube evaporators and condensers.",
  },
  electric_motor: {
    name: "Electric Motor",
    desc: "Three-phase induction motors with stator windings and DE/NDE bearings.",
  },
  conveyor: {
    name: "Conveyor System",
    desc: "Bulk material belt conveyors with pulleys, gear reducers, and drift switches.",
  },
};

export function EquipmentStep({
  control,
  register,
  errors,
  watch,
}: EquipmentStepProps) {
  const selectedType = watch("equipmentType");
  const typeInfo = EQUIPMENT_LABELS[selectedType] || EQUIPMENT_LABELS.centrifugal_pump;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Step 1: Equipment Identification
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select the asset category and enter the physical unit identifier.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Equipment Type */}
        <div className="space-y-1.5">
          <label
            htmlFor="equipmentType"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Equipment Type <span className="text-red-500">*</span>
          </label>
          <Controller
            control={control}
            name="equipmentType"
            render={({ field }) => (
              <Select
                name={field.name}
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="equipmentType"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.equipmentType)}
                  className="h-11 px-3.5"
                >
                  <SelectValue placeholder="Select equipment type" />
                </SelectTrigger>
                <SelectContent>
                  {BASE_EQUIPMENT_TYPES.map((type: EquipmentType) => (
                    <SelectItem key={type} value={type}>
                      {EQUIPMENT_LABELS[type].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.equipmentType && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.equipmentType.message}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1 mt-1">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-700" />
            <span>{typeInfo.desc}</span>
          </p>
        </div>

        {/* Equipment Identifier */}
        <div className="space-y-1.5">
          <label
            htmlFor="equipmentId"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Equipment ID / Asset Tag <span className="text-red-500">*</span>
          </label>
          <input
            id="equipmentId"
            type="text"
            placeholder="e.g. PUMP-101, COMP-4A, CHL-02"
            maxLength={50}
            {...register("equipmentId")}
            className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {errors.equipmentId && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.equipmentId.message}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Physical identifier stamped on asset tag or electrical panel.
          </p>
        </div>

        {/* Reported By */}
        <div className="space-y-1.5 md:col-span-2">
          <label
            htmlFor="reportedBy"
            className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
          >
            Reported By (Technician / Operator) <span className="text-red-500">*</span>
          </label>
          <input
            id="reportedBy"
            type="text"
            placeholder="e.g. John Doe, Badge #4812"
            {...register("reportedBy")}
            className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {errors.reportedBy && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              {errors.reportedBy.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
