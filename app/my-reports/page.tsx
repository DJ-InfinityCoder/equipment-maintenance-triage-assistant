import Link from "next/link";
import { redirect } from "next/navigation";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { listTriageRecords } from "@/lib/db/repos/triage";
import { EQUIPMENT_LABELS } from "@/lib/schemas/equipment";
import { ArrowLeft, ClipboardList, Plus, Wrench, ChevronLeft, ChevronRight } from "lucide-react";

interface MyReportsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function MyReportsPage({ searchParams }: MyReportsPageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login?next=%2Fmy-reports");
  if (session.role !== "reporter") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = await listTriageRecords({
    filter: { reportedByUserId: session.id },
    pagination: { page, limit: 20 },
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/report"
              aria-label="Back to report form"
              className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5" />
              <div>
                <h1 className="text-2xl font-bold">My Reports</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  View your submitted equipment reports and continue pending follow-up.
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/report"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </header>

        {result.items.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 font-semibold">No reports yet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Reports you submit will appear here.
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {result.items.map((record) => {
              const canEdit = record.workOrder.status === "draft";
              return (
                <article
                  key={record.id}
                  className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold">{record.issueReport.equipmentId}</h2>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                          {EQUIPMENT_LABELS[record.issueReport.equipmentType]}
                        </span>
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          {record.workOrder.status}
                        </span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase dark:bg-slate-800">
                          {record.finalPriority} priority
                        </span>
                      </div>
                      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                        {record.issueReport.issueDescription}
                      </p>
                      <p className="text-xs text-slate-500">
                        Submitted {new Date(record.createdAt).toLocaleString()} · Reference{" "}
                        <span className="font-mono">{record.id}</span>
                      </p>
                      {record.followUpAnswers && record.followUpAnswers.length > 0 && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          {record.followUpAnswers.length} follow-up answer(s) saved
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {canEdit && (
                        <Link
                          href={`/my-reports/${encodeURIComponent(record.id)}/edit`}
                          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Edit report
                        </Link>
                      )}
                      <Link
                        href={`/triage/${encodeURIComponent(record.id)}`}
                        className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                      >
                        Open report
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {result.total > result.limit && (
          <nav
            aria-label="My reports pages"
            className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            <span className="text-xs text-slate-500">
              Page {result.page} of {totalPages} · {result.total} reports
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/my-reports?page=${page - 1}`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/my-reports?page=${page + 1}`}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}
