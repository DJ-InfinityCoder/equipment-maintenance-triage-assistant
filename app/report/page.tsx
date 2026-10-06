"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IssueReportInput,
  IssueReportInputSchema,
} from "@/lib/schemas/issue-report";
import {
  Stepper,
  EquipmentStep,
  IssueEventsStep,
  SensorReadingsStep,
  ReviewStep,
} from "@/components/report";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  RotateCcw,
  Sparkles,
  Wrench,
} from "lucide-react";

interface ApiTriageResponse {
  triageId?: string;
  error?: string;
  userMessage?: string;
  code?: string;
}

export default function ReportPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<{ name: string; role: string } | null>(null);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    reset,
    getValues,
    formState: { errors },
  } = useForm<IssueReportInput>({
    resolver: zodResolver(IssueReportInputSchema),
    defaultValues: {
      equipmentType: "centrifugal_pump",
      equipmentId: "",
      issueDescription: "",
      recentEvents: [{ description: "" }],
      sensorReadings: [],
      reportedBy: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    let active = true;

    void fetch("/api/auth/session")
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to verify your signed-in account.");
        return res.json();
      })
      .then((payload) => {
        if (!active) return;
        const submitted = new URLSearchParams(window.location.search).get("submitted");
        if (submitted) setSubmittedReportId(submitted);
        if (!payload?.user || payload.user.role !== "reporter") {
          throw new Error("A reporter account is required to submit an issue.");
        }
        setSessionUser(payload.user);
        setValue("reportedBy", payload.user.name);
      })
      .catch((error: unknown) => {
        if (active) {
          setApiError(error instanceof Error ? error.message : "Unable to verify your account.");
        }
      });

    return () => {
      active = false;
    };
  }, [setValue]);

  const formData = getValues();

  // Validate only relevant fields before proceeding to the next step
  const handleNextStep = async () => {
    setApiError(null);
    let stepValid = false;

    if (currentStep === 1) {
      stepValid = await trigger(
        ["equipmentType", "equipmentId", "reportedBy"],
        { shouldFocus: true }
      );
    } else if (currentStep === 2) {
      stepValid = await trigger(
        ["issueDescription", "recentEvents"],
        { shouldFocus: true }
      );
    } else if (currentStep === 3) {
      // Sensor readings are optional; validate if any entered rows have invalid numbers
      stepValid = await trigger("sensorReadings", { shouldFocus: true });
    }

    if (stepValid) {
      setCurrentStep((prev) => Math.min(4, prev + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setApiError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: IssueReportInput) => {
    setApiError(null);
    setIsSubmitting(true);

    try {
      // Clean up empty sensor readings if any before posting
      const cleanedData: IssueReportInput = {
        ...data,
        sensorReadings: (data.sensorReadings || []).filter(
          (r) => r.key?.trim() && !isNaN(Number(r.value)) && r.unit?.trim()
        ),
      };

      let response: Response;
      try {
        response = await fetch("/api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanedData),
        });
      } catch {
        // Client network failure (e.g. offline, connection refused, DNS failed)
        setApiError(
          "Network connection failure: Unable to reach the server. Your form data is still on this page. Please verify your internet connection and retry."
        );
        return;
      }

      let result: ApiTriageResponse | null = null;
      try {
        result = (await response.json()) as ApiTriageResponse;
      } catch {
        // Non-JSON response
      }

      if (!response.ok) {
        if (
          result?.code === "DATABASE_ERROR" ||
          (typeof result?.error === "string" && result.error.includes("Database")) ||
          (typeof result?.userMessage === "string" && result.userMessage.includes("Database")) ||
          response.status === 500
        ) {
          throw new Error(
            `DatabaseError: ${result?.userMessage || result?.error || "Database operation failed. The database is unreachable."}`
          );
        }
        throw new Error(
          result?.userMessage ||
            result?.error ||
            `Server returned HTTP ${response.status}`
        );
      }

      if (!result?.triageId) {
        throw new Error("Server response did not include a triage ID.");
      }

      // Show the reporter the saved dossier and any questions that need answers.
      setSubmittedReportId(result.triageId);
      router.push(`/triage/${encodeURIComponent(result.triageId)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };
  const submitReport = handleSubmit(onSubmit);

  // Quick fill sample scenario for rapid technician demonstration
  const handleQuickDemoFill = () => {
    reset({
      equipmentType: "centrifugal_pump",
      equipmentId: "PUMP-101",
      issueDescription:
        "Persistent water leakage pooling beneath the mechanical seal gland with unusual high casing vibration.",
      recentEvents: [
        {
          description: "Shift technician noted seal drip rate increasing at 06:30",
          occurredAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        },
      ],
      sensorReadings: [
        { key: "seal_leakage_flow_mlpm", value: 38, unit: "ml/min" },
        { key: "vibration_rms_mms", value: 5.4, unit: "mm/s" },
        { key: "bearing_temp_c", value: 76, unit: "celsius" },
      ],
      reportedBy: sessionUser?.name || "",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="Maintenance Triage home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                Maintenance Triage
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Equipment operations
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-2">
            {sessionUser ? (
              <>
                <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {sessionUser.name} · {sessionUser.role}
                </span>
                <Link
                  href="/my-reports"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  My Reports
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Login
              </Link>
            )}
            {sessionUser?.role === "technician" && (
              <Link
                href="/dashboard"
                className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {submittedReportId && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            Your report was saved for technician review. Reference:{" "}
            <Link
              href={`/triage/${encodeURIComponent(submittedReportId)}`}
              className="font-mono font-semibold underline underline-offset-2"
            >
              {submittedReportId}
            </Link>
            . Open your report to answer any follow-up questions.
          </div>
        )}

        {/* PAGE HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Equipment Triage Report
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Submit observed physical equipment symptoms and telemetry for deterministic safety evaluation and AI triage.
            </p>
          </div>
          <button
            type="button"
            onClick={handleQuickDemoFill}
            disabled={isSubmitting}
            className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-300 dark:bg-black/40 dark:text-slate-600 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 sm:self-auto"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Quick Demo Fill
          </button>
        </header>

        {/* STEPPER PROGRESS BAR */}
        <Stepper
          currentStep={currentStep}
          onStepClick={(step) => setCurrentStep(step)}
          isSubmitting={isSubmitting}
        />

        {/* FORM CONTAINER */}
        <main className="rounded-md border border-slate-200 bg-white p-5 sm:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={(event) => event.preventDefault()} className="space-y-6">
            {/* STEP 1: EQUIPMENT */}
            {currentStep === 1 && (
              <EquipmentStep
                control={control}
                register={register}
                errors={errors}
                watch={watch}
              />
            )}

            {/* STEP 2: ISSUE & EVENTS */}
            {currentStep === 2 && (
              <IssueEventsStep
                register={register}
                errors={errors}
                control={control}
                watch={watch}
                setValue={setValue}
              />
            )}

            {/* STEP 3: SENSORS */}
            {currentStep === 3 && (
              <SensorReadingsStep
                register={register}
                control={control}
                watch={watch}
                setValue={setValue}
              />
            )}

            {/* STEP 4: REVIEW */}
            {currentStep === 4 && (
              <ReviewStep
                formData={formData}
                isSubmitting={isSubmitting}
                apiError={apiError}
                onRetrySubmit={() => void submitReport()}
              />
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-1.5 rounded-md bg-black px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 dark:bg-black dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    Next Step
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitReport()}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-md bg-black px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 dark:bg-black dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <RotateCcw className="h-4 w-4 animate-spin" />
                        Processing Triage...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Triage Report
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
