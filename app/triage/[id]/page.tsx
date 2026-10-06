import { notFound } from "next/navigation";
import { getTriageRecord } from "@/lib/db/repos/triage";
import { TriageView } from "@/components/triage";
import { readSessionFromCookieStore } from "@/lib/auth/session";
import { redirect } from "next/navigation";

interface TriagePageProps {
  params: Promise<{ id: string }>;
}

export default async function TriagePage({ params }: TriagePageProps) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login");

  const { id } = await params;

  const record = await getTriageRecord(id);

  if (!record) {
    notFound();
  }

  if (
    session.role === "reporter" &&
    record.issueReport.reportedByUserId !== session.id
  ) {
    redirect("/my-reports");
  }

  return (
    <TriageView
      initialRecord={record}
      userRole={session.role}
      userName={session.name}
    />
  );
}
