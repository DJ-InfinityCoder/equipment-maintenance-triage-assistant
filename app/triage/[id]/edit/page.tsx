import { notFound, redirect } from "next/navigation";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { getTriageRecord } from "@/lib/db/repos/triage";
import { ReporterReportEditor } from "@/components/report/ReporterReportEditor";

interface EditTriageReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTriageReportPage({
  params,
}: EditTriageReportPageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login");
  if (session.role !== "technician") redirect("/my-reports");

  const { id } = await params;
  const record = await getTriageRecord(id);
  if (!record) notFound();
  if (record.workOrder.status !== "draft") {
    redirect(`/triage/${encodeURIComponent(record.id)}`);
  }

  return (
    <ReporterReportEditor
      triageId={record.id}
      initialReport={record.issueReport}
      backHref={`/triage/${encodeURIComponent(record.id)}`}
    />
  );
}
