import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest, AuthConfigurationError, SessionUser } from "./session";
import { UserRole } from "@/lib/schemas/user";

type AuthorizationResult =
  | { authorized: true; session: SessionUser }
  | { authorized: false; response: NextResponse };

export async function authorizeRequest(
  request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<AuthorizationResult> {
  let session: SessionUser | null;
  try {
    session = await readSessionFromRequest(request);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication is not configured on this server." },
        { status: 503 }
      ),
    };
  }

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Sign in is required." }, { status: 401 }),
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Your account is not permitted to perform this action." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, session };
}
