import { redirect } from "next/navigation";
import { readSessionFromCookieStore } from "@/lib/auth/session";

export default async function ReporterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await readSessionFromCookieStore();
  if (!session) redirect("/login?next=%2Freport");
  if (session.role !== "reporter") redirect("/dashboard");

  return children;
}
