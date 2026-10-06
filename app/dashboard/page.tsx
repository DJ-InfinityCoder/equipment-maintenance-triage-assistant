import React from "react";
import Link from "next/link";
import {
  listTriageRecords,
  getDashboardSummaryStats,
} from "@/lib/db/repos/triage";
import {
  EquipmentType,
  PriorityLevel,
  TriageRecord,
  WorkOrderStatus,
  BASE_EQUIPMENT_TYPES,
  EQUIPMENT_LABELS,
  PRIORITY_LEVELS,
} from "@/lib/schemas";
import {
  Wrench,
  AlertTriangle,
  FileCheck2,
  Brain,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  FolderOpen,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardSummaryStats } from "@/lib/db/repos/triage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    status?: string;
    priority?: string;
    equipmentType?: string;
    search?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login?next=%2Fdashboard");
  if (session.role !== "technician") redirect("/report");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.max(1, Math.min(50, parseInt(params.limit || "10", 10)));
  const statusFilter = params.status as WorkOrderStatus | undefined;
  const priorityFilter = params.priority as PriorityLevel | undefined;
  const equipmentTypeFilter = params.equipmentType as EquipmentType | undefined;
  const searchTerm = params.search?.trim() || "";

  // Fetch summary stats and paginated records with graceful resilience
  let stats: DashboardSummaryStats = {
    openDrafts: 0,
    criticalOpen: 0,
    failedAiRuns: 0,
    approvedThisWeek: 0,
  };
  let recordsResult: {
    items: TriageRecord[];
    total: number;
    page: number;
    limit: number;
  } = {
    items: [],
    total: 0,
    page,
    limit,
  };
  let dbError: string | null = null;

  try {
    const [fetchedStats, fetchedRecords] = await Promise.all([
      getDashboardSummaryStats(),
      listTriageRecords({
        filter: {
          status: statusFilter,
          priority: priorityFilter,
          equipmentType: equipmentTypeFilter,
          search: searchTerm || undefined,
        },
        pagination: { page, limit },
      }),
    ]);
    stats = fetchedStats;
    recordsResult = fetchedRecords;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const userMessage =
      err && typeof err === "object" && "userMessage" in err
        ? String((err as { userMessage?: unknown }).userMessage ?? "")
        : "";
    dbError =
      userMessage || message ||
      "Unable to connect to the MongoDB telemetry store. Please verify your connection string in .env.local.";
    console.error("Dashboard database fetch warning:", err);
  }

  const { items, total } = recordsResult;
  const totalPages = Math.max(1, Math.ceil(total / limit));


  // Helper to build URL with preserved query parameters
  const createQueryUrl = (updates: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    if (params.status) current.set("status", params.status);
    if (params.priority) current.set("priority", params.priority);
    if (params.equipmentType) current.set("equipmentType", params.equipmentType);
    if (params.search) current.set("search", params.search);
    if (params.limit) current.set("limit", params.limit);
    current.set("page", String(page));

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "" || val === "all") {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    }
    return `/dashboard?${current.toString()}`;
  };

  const activeFilterCount = [
    statusFilter,
    priorityFilter,
    equipmentTypeFilter,
    searchTerm,
  ].filter((value) => Boolean(value) && value !== "all").length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="light-ui min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-black selection:text-white">
      {/* ------------------------------------------------------------------ */}
      {/* TOP NAVIGATION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-md bg-black flex items-center justify-center text-white shadow-md shadow-slate-900/10 hover:bg-slate-800 transition-colors"
            >
              <Wrench className="h-5 w-5" />
            </Link>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block">
                Maintenance Triage
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">
                Operations dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session ? (
              <>
                <span className="hidden items-center gap-2 rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 sm:inline-flex">
                  <UserRound className="h-3.5 w-3.5" />
                  {session.name} · {session.role}
                </span>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/report"
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Report Issue
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* DATABASE WARNING BANNER */}
        {dbError && (
          <div className="rounded-md border border-red-500/40 bg-red-950/30 p-5 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-red-950/20">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 shrink-0 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-red-200">
                    Database Unreachable
                  </h2>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                    Offline
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {dbError} Please verify your connection string in <code className="font-mono text-red-300">.env.local</code> and ensure your network can reach the MongoDB cluster.
                </p>
              </div>
            </div>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-500 transition-all shrink-0 cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry Connection
            </a>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 1. TOP SUMMARY KPI CARDS                                           */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Open Drafts */}
          <div className="rounded-md border border-slate-800 bg-slate-800/40 p-5 shadow-xs backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Open Drafts
              </span>
              <div className="h-8 w-8 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {stats.openDrafts}
              </span>
              <span className="text-xs text-amber-400 font-medium">pending review</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Work orders drafted by AI, awaiting technician authorization.
            </p>
          </div>

          {/* Card 2: Critical Open */}
          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-5 shadow-xs backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                Critical Open
              </span>
              <div className="h-8 w-8 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-400 font-mono">
                {stats.criticalOpen}
              </span>
              <span className="text-xs text-red-400 font-medium">high hazard</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Deterministic rule floor breached or hazardous sensor thresholds.
            </p>
          </div>

          {/* Card 3: Failed AI Runs */}
          <div className="rounded-md border border-slate-800 bg-slate-800/40 p-5 shadow-xs backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Failed AI Runs
              </span>
              <div className="h-8 w-8 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Brain className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {stats.failedAiRuns}
              </span>
              <span className="text-xs text-violet-400 font-medium">safe fallback</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Gracefully degraded to deterministic rule floor without stalling plant ops.
            </p>
          </div>

          {/* Card 4: Approved This Week */}
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Approved This Week
              </span>
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {stats.approvedThisWeek}
              </span>
              <span className="text-xs text-emerald-400 font-medium">released to field</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Authorized and stamped by qualified technicians in the last 7 days.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 2. FILTERS & SEARCH TOOLBAR                                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Filter className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Filter triage records
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Narrow results by asset, status, priority, or equipment type.
                </p>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                  {activeFilterCount} active{" "}
                  {activeFilterCount === 1 ? "filter" : "filters"}
                </span>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-slate-600 underline-offset-4 transition-colors hover:text-slate-950 hover:underline"
                >
                  Clear filters
                </Link>
              </div>
            )}
          </div>

          <form
            method="GET"
            action="/dashboard"
            className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.35fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(180px,1.35fr)_minmax(128px,0.85fr)]"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-search"
                className="block text-xs font-medium text-slate-600"
              >
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="dashboard-search"
                  type="text"
                  name="search"
                  defaultValue={searchTerm}
                  placeholder="Equipment ID"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-status"
                className="block text-xs font-medium text-slate-600"
              >
                Status
              </label>
              <Select name="status" defaultValue={statusFilter || "all"}>
                <SelectTrigger
                  id="dashboard-status"
                  className="h-10 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-priority"
                className="block text-xs font-medium text-slate-600"
              >
                Priority
              </label>
              <Select name="priority" defaultValue={priorityFilter || "all"}>
                <SelectTrigger
                  id="dashboard-priority"
                  className="h-10 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITY_LEVELS.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="dashboard-equipment-type"
                className="block text-xs font-medium text-slate-600"
              >
                Equipment type
              </label>
              <Select
                name="equipmentType"
                defaultValue={equipmentTypeFilter || "all"}
              >
                <SelectTrigger
                  id="dashboard-equipment-type"
                  className="h-10 text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All equipment types</SelectItem>
                  {BASE_EQUIPMENT_TYPES.map((type: EquipmentType) => (
                    <SelectItem key={type} value={type}>
                      {EQUIPMENT_LABELS[type] || type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <span className="block h-4" aria-hidden="true" />
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                Apply filters
              </button>
            </div>
          </form>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* 3. RECENT TRIAGE RECORDS TABLE                                     */}
        {/* ------------------------------------------------------------------ */}
        <section className="rounded-md border border-slate-800 bg-slate-800/40 backdrop-blur-sm overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Triage Dossier Registry
                <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-semibold text-slate-300">
                  {total} record{total !== 1 ? "s" : ""}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Equipment telemetry breaches, deterministic safety evaluations, and work order records.
              </p>
            </div>
          </div>

          {items.length === 0 ? (
            /* EMPTY STATE */
            <div className="py-16 px-4 text-center space-y-4">
              <div className="mx-auto h-16 w-16 rounded-md bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                <FolderOpen className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-white">No Triage Records Found</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {hasActiveFilters
                    ? "No records match your selected filters. Try broadening your criteria or clear the search query."
                    : "No equipment triage records have been recorded yet. Launch an issue report to initiate safety evaluation."}
                </p>
              </div>
              <div className="pt-2">
                {hasActiveFilters ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    Clear Active Filters
                  </Link>
                ) : (
                  <Link
                    href="/report"
                    className="inline-flex items-center gap-2 rounded-md bg-black px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Report New Issue
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Equipment ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">AI Status</th>
                    <th className="py-3 px-4">Created Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((rec) => {
                    const aiStatus = rec.ai?.status ?? (rec.aiTriage ? "ok" : "skipped");
                    const isCritical = rec.finalPriority === "critical";
                    const isHigh = rec.finalPriority === "high";

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Equipment ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <Link
                            href={`/equipment/${encodeURIComponent(rec.issueReport.equipmentId)}`}
                            className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-600 hover:underline cursor-pointer"
                            title="View equipment history timeline"
                          >
                            <span>{rec.issueReport.equipmentId}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>

                        {/* Equipment Type */}
                        <td className="py-3.5 px-4 text-slate-300 capitalize">
                          {rec.issueReport.equipmentType.replace(/_/g, " ")}
                        </td>

                        {/* Final Priority Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                              isCritical
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : isHigh
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-black/10 text-slate-700 border border-slate-300"
                            }`}
                          >
                            {isCritical && <AlertTriangle className="h-3 w-3" />}
                            {rec.finalPriority}
                          </span>
                        </td>

                        {/* Work Order Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${
                              rec.workOrder.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : rec.workOrder.status === "rejected"
                                ? "bg-red-500/10 text-red-300 border-red-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {rec.workOrder.status === "approved" && (
                              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            )}
                            {rec.workOrder.status === "rejected" && (
                              <XCircle className="h-3 w-3 text-red-400" />
                            )}
                            {rec.workOrder.status === "draft" && (
                              <Clock className="h-3 w-3 text-amber-400" />
                            )}
                            {rec.workOrder.status}
                          </span>
                        </td>

                        {/* AI Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              aiStatus === "ok"
                                ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800"
                                : aiStatus === "failed"
                                ? "bg-red-950/60 text-red-400 border border-red-800"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {aiStatus === "ok" ? "OK" : aiStatus === "failed" ? "FAILED" : "SKIPPED"}
                          </span>
                        </td>

                        {/* Created Time */}
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(rec.createdAt).toLocaleDateString()} &bull;{" "}
                          {new Date(rec.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/triage/${rec.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-300 hover:text-white transition-all cursor-pointer"
                          >
                            <span>Dossier</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* 4. PAGINATION FOOTER                                               */}
          {/* ------------------------------------------------------------------ */}
          {total > 0 && (
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 font-mono">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(total, page * limit)} of {total} records
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={createQueryUrl({ page: String(Math.max(1, page - 1)) })}
                  aria-disabled={page <= 1}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-700 ${
                    page <= 1
                      ? "opacity-40 pointer-events-none"
                      : "hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Link>

                <span className="px-2 text-slate-300 font-semibold">
                  Page {page} of {totalPages}
                </span>

                <Link
                  href={createQueryUrl({ page: String(Math.min(totalPages, page + 1)) })}
                  aria-disabled={page >= totalPages}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-700 ${
                    page >= totalPages
                      ? "opacity-40 pointer-events-none"
                      : "hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
