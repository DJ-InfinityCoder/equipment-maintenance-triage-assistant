"use client";

import React from "react";
import { Wrench, FileText, Activity, CheckSquare } from "lucide-react";

export interface StepItem {
  id: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const REPORT_STEPS: StepItem[] = [
  { id: 1, title: "Equipment", subtitle: "Type & ID", icon: Wrench },
  { id: 2, title: "Issue & Events", subtitle: "Symptoms", icon: FileText },
  { id: 3, title: "Sensors", subtitle: "Telemetry", icon: Activity },
  { id: 4, title: "Review", subtitle: "Confirm & Submit", icon: CheckSquare },
];

interface StepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  isSubmitting?: boolean;
}

export function Stepper({ currentStep, onStepClick, isSubmitting = false }: StepperProps) {
  return (
    <nav aria-label="Triage Report Steps" className="w-full">
      <ol className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {REPORT_STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => !isSubmitting && onStepClick(step.id)}
                disabled={isSubmitting}
                aria-current={isActive ? "step" : undefined}
                className={`w-full text-left p-3 rounded-md border transition-all duration-150 flex items-center gap-3 cursor-pointer disabled:cursor-not-allowed ${
                  isActive
                    ? "border-slate-300 bg-slate-100 text-slate-900 shadow-sm dark:border-slate-300 dark:bg-black/40 dark:text-slate-600 ring-2 focus:ring-slate-900/10"
                    : isCompleted
                    ? "border-emerald-300 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-black text-white shadow-sm"
                      : isCompleted
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                      Step {step.id}
                    </span>
                  </div>
                  <div className="truncate text-sm font-bold">{step.title}</div>
                  <div className="truncate text-xs opacity-80 hidden sm:block">
                    {step.subtitle}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
