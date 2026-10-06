"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, Home, ShieldAlert } from "lucide-react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("Root application error caught by boundary:", error);
  }, [error]);

  const isDbError =
    error.message?.toLowerCase().includes("database") ||
    error.message?.toLowerCase().includes("mongo") ||
    error.message?.toLowerCase().includes("topology") ||
    error.message?.toLowerCase().includes("connect");

  return (
    <div className="light-ui min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-md border border-red-500/30 bg-slate-800/80 p-8 shadow-2xl backdrop-blur-md space-y-6 text-center">
        <div className="mx-auto h-16 w-16 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          {isDbError ? (
            <ShieldAlert className="h-8 w-8" />
          ) : (
            <AlertTriangle className="h-8 w-8" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {isDbError ? "Database Unreachable" : "Application Error"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            {isDbError
              ? "Unable to connect to the MongoDB database. Please verify your connection string in .env.local and ensure the database cluster is reachable."
              : error.message || "An unexpected error occurred in the application."}
          </p>
        </div>

        {error.digest && (
          <div className="rounded-md bg-slate-900/80 border border-slate-700 p-2.5 font-mono text-[11px] text-slate-400 select-all">
            Digest: {error.digest}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-red-500 transition-all cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            Retry
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
