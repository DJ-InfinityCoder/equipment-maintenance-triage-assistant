import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  FilePlus2,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { readSessionFromCookieStore } from "@/lib/auth/session";

const capabilities = [
  {
    icon: ShieldCheck,
    title: "Safety stays deterministic",
    description:
      "Threshold rules set the minimum response priority. Recommendations can never lower that floor.",
  },
  {
    icon: Activity,
    title: "Recommendations stay grounded",
    description:
      "Inspection guidance is backed by equipment manuals, reported events, and submitted readings.",
  },
  {
    icon: ClipboardCheck,
    title: "Technicians stay in control",
    description:
      "Every work order starts as a draft. Only a technician can record findings or approve the work.",
  },
];

export default async function Home() {
  const session = await readSessionFromCookieStore();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 selection:bg-slate-100 selection:text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Maintenance Triage home">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950">
                Maintenance Triage
              </span>
              <span className="block text-xs text-slate-500">
                Equipment operations
              </span>
            </span>
          </Link>

          <nav aria-label="Main navigation" className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 sm:inline-flex">
                  <UserRound className="h-3.5 w-3.5" />
                  {session.name} · {session.role}
                </span>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
                  >
                    Logout
                  </button>
                </form>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
                >
                  Login
                </Link>
                <ButtonLink href="/register">
                  Create account
                </ButtonLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <Badge className="mb-6 gap-2 border-slate-200 bg-slate-100 text-slate-900">
              <span className="h-1.5 w-1.5 rounded-md bg-black" />
              Maintenance decision support
            </Badge>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.5rem]">
              Move from equipment issue to confident action.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Bring symptoms, operating events, and sensor readings together.
              Get a cited triage recommendation that keeps safety rules and
              technician judgment at the center.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <ButtonLink
                href={session?.role === "reporter" ? "/report" : session?.role === "technician" ? "/dashboard" : "/login"}
              >
                {session?.role === "reporter"
                  ? "Create issue report"
                  : session?.role === "technician"
                    ? "Open technician dashboard"
                    : "Sign in to continue"}
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <Link
                href="#workflow"
                className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-950"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Advisory recommendations only. Work orders require technician
              review and approval.
            </p>
          </div>

          <Card className="overflow-hidden rounded-md shadow-md shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Triage workflow
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  A clear, reviewable process
                </p>
              </div>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                Human-led
              </span>
            </div>
            <CardContent className="space-y-0 px-5 py-2">
              <WorkflowStep
                number="01"
                title="Capture the issue"
                description="Record asset details, symptoms, events, and readings."
                icon={FilePlus2}
                complete
              />
              <WorkflowStep
                number="02"
                title="Evaluate safety rules"
                description="Deterministic thresholds establish the minimum priority."
                icon={ShieldCheck}
                complete
              />
              <WorkflowStep
                number="03"
                title="Review a cited draft"
                description="Inspect evidence, edit the work order, then decide."
                icon={ClipboardCheck}
              />
            </CardContent>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              No automated approvals or equipment commands
            </div>
          </Card>
        </section>

        <section
          id="workflow"
          className="scroll-mt-24 border-y border-slate-200 bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
            <div className="mb-7 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                How it works
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                From equipment issue to reviewed work order.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Each step keeps evidence visible, safety checks deterministic,
                and the final decision with a human technician.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <Card key={title} className="shadow-none">
                  <CardContent className="p-5">
                    <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Equipment Maintenance Triage Assistant</p>
          <p>Evidence-led guidance. Technician-approved work.</p>
        </section>
      </main>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  icon: Icon,
  complete = false,
}: {
  number: string;
  title: string;
  description: string;
  icon: typeof FilePlus2;
  complete?: boolean;
}) {
  return (
    <div className="flex gap-4 border-b border-slate-100 py-5 last:border-b-0">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-md ${
            complete
              ? "bg-slate-900 text-white"
              : "border border-slate-300 bg-white text-slate-600"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="mt-2 font-mono text-[10px] text-slate-400">{number}</span>
      </div>
      <div className="pt-0.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
      </div>
    </div>
  );
}
