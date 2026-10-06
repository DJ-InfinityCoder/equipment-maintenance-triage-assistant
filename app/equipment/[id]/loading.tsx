import React from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default function EquipmentLoading() {
  return (
    <div className="light-ui min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* STABLE TOP NAVIGATION                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="h-5 w-40 bg-slate-800 rounded-md animate-pulse" />
              <div className="h-3 w-28 bg-slate-800/60 rounded-md mt-1 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/report"
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md"
            >
              <Plus className="h-4 w-4" />
              Report Issue
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* SKELETON BODY                                                      */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* RECURRENCE BANNER SKELETON */}
        <div className="rounded-md border border-slate-800 bg-slate-800/40 p-5 space-y-2">
          <div className="h-5 w-72 bg-slate-800 rounded-md animate-pulse" />
          <div className="h-4 w-96 bg-slate-800/60 rounded-md animate-pulse" />
        </div>

        {/* TIMELINE SKELETON */}
        <div className="space-y-4 pl-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-slate-800 bg-slate-800/30 p-5 space-y-3"
            >
              <div className="flex justify-between">
                <div className="h-5 w-40 bg-slate-800 rounded-md animate-pulse" />
                <div className="h-5 w-24 bg-slate-800/50 rounded-md animate-pulse" />
              </div>
              <div className="h-4 w-full bg-slate-800/40 rounded-md animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-800/30 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
