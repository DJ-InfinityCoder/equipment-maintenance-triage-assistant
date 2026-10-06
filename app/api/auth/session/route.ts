import { NextRequest, NextResponse } from "next/server";
import {
  AuthConfigurationError,
  readSessionFromRequest,
  SessionUser,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  let session: SessionUser | null;
  try {
    session = await readSessionFromRequest(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured on this server." },
        { status: 503 }
      );
    }
    throw error;
  }

  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({ user: session }, { status: 200 });
}
