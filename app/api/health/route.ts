import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const isHealthy = await pingDb();

  return NextResponse.json(
    { db: isHealthy ? "ok" : "down" },
    { status: isHealthy ? 200 : 503 }
  );
}
