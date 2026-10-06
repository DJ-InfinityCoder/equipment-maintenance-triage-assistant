import React from "react";
import Link from "next/link";
import { Wrench, Plus } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="light-ui min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* STABLE TOP NAVIGATION (Prevents layout shift & header flicker)       */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="h-9 w-9 rounded-md bg-black flex items-center justify-center text-white shadow-md shadow-slate-900/10"
            >
              <Wrench className="h-5 w-5" />
            </Link>
            <div>
              <span className="font-semibold text-base tracking-tight text-white block">
                Maintenance Triage
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">
                Operations dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/report"
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Report Issue
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MAIN SKELETON CONTENT                                               */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 4 SUMMARY KPI CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-slate-800 bg-slate-800/40 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 bg-slate-800 rounded-md animate-pulse" />
                <div className="h-8 w-8 rounded-md bg-slate-800/80 animate-pulse" />
              </div>
              <div className="h-8 w-20 bg-slate-800 rounded-md animate-pulse" />
              <div className="h-3 w-36 bg-slate-800/50 rounded-md animate-pulse" />
            </div>
          ))}
        </section>

        {/* FILTERS TOOLBAR SKELETON */}
        <section className="rounded-md border border-slate-800 bg-slate-800/30 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-800/60 rounded-md animate-pulse" />
            <div className="flex gap-2">
              <div className="h-10 w-28 bg-slate-800/60 rounded-md animate-pulse" />
              <div className="h-10 w-28 bg-slate-800/60 rounded-md animate-pulse" />
              <div className="h-10 w-28 bg-slate-800/60 rounded-md animate-pulse" />
            </div>
          </div>
        </section>

        {/* TABLE SKELETON */}
        <section className="rounded-md border border-slate-800 bg-slate-800/20 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
            <div className="h-5 w-40 bg-slate-800 rounded-md animate-pulse" />
            <div className="h-4 w-24 bg-slate-800/60 rounded-md animate-pulse" />
          </div>
          <div className="divide-y divide-slate-800/60 p-2 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-800/30 rounded-md animate-pulse" />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
