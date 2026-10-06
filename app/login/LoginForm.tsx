"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Wrench } from "lucide-react";

interface DemoAccount {
  name: string;
  email: string;
  password: string;
  role: "reporter" | "technician";
}

export default function LoginForm({
  demoAccounts,
}: {
  demoAccounts: DemoAccount[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      router.push(data.user?.role === "technician" ? "/dashboard" : "/report");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sign in</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in to continue to your maintenance workspace.</p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {demoAccounts.length > 0 && (
            <section className="mt-7 rounded-md border border-amber-200 bg-amber-50 p-4" aria-label="Demo accounts">
              <h2 className="text-sm font-semibold text-amber-950">Demo accounts for evaluation</h2>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                Click &ldquo;Use&rdquo; below to quickly populate credentials and evaluate reporter or technician capabilities.
              </p>
              <div className="mt-3 space-y-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-xs text-slate-800 hover:bg-amber-100"
                  >
                    <span>
                      <span className="block font-semibold">{account.name} · {account.role}</span>
                      <span className="mt-0.5 block font-mono">{account.email} / {account.password}</span>
                    </span>
                    <span className="shrink-0 font-semibold">Use</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="mt-6 text-sm text-slate-600">
            Need an account? <Link href="/register" className="font-medium text-slate-950 underline underline-offset-4">Create one</Link>
          </p>
          <p className="mt-3 text-sm text-slate-600">
            <Link href="/" className="font-medium text-slate-700 hover:text-slate-950">Return home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
