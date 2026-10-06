import { notFound, redirect } from "next/navigation";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { getTriageRecord } from "@/lib/db/repos/triage";
import { ReporterReportEditor } from "@/components/report/ReporterReportEditor";

interface EditReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReportPage({ params }: EditReportPageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login?next=%2Fmy-reports");
  if (session.role !== "reporter") redirect("/dashboard");

  const { id } = await params;
  const record = await getTriageRecord(id);
  if (!record) notFound();
  if (record.issueReport.reportedByUserId !== session.id) redirect("/my-reports");
  if (record.workOrder.status !== "draft") {
    redirect(`/triage/${encodeURIComponent(record.id)}`);
  }

  return (
    <ReporterReportEditor
      triageId={record.id}
      initialReport={record.issueReport}
    />
  );
}
