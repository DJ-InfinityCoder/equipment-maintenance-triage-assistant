"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Wrench } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"reporter" | "technician">("reporter");
  const [technicianInviteCode, setTechnicianInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, technicianInviteCode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      router.push(data.user?.role === "technician" ? "/dashboard" : "/report");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create an account.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Maintenance Triage home">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight text-slate-950">Maintenance Triage</span>
              <span className="block text-xs text-slate-500">Equipment operations</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-md rounded-md border border-slate-200 bg-white p-8 shadow-md shadow-slate-200/60">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Create account</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Join the triage workflow</h1>
            <p className="mt-2 text-sm text-slate-600">Create a reporter account or register as a technician with an invitation.</p>
          </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              minLength={8}
              required
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "reporter" | "technician")}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="reporter">Reporter / Operator</option>
              <option value="technician">Technician (invitation required)</option>
            </select>
          </div>

          {role === "technician" && (
            <div>
              <label htmlFor="technicianInviteCode" className="mb-1 block text-sm font-medium text-slate-700">
                Technician invitation code
              </label>
              <input
                id="technicianInviteCode"
                type="password"
                autoComplete="off"
                value={technicianInviteCode}
                onChange={(event) => setTechnicianInviteCode(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>
          )}

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Creating account..." : "Create account"}
          </button>
        </form>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account? <Link href="/login" className="font-medium text-slate-950 underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
