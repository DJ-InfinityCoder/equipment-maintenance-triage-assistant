import { NextRequest, NextResponse } from "next/server";
import {
  AuthConfigurationError,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session: Awaited<ReturnType<typeof verifySessionToken>> = null;

  try {
    session = token ? await verifySessionToken(token) : null;
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    return NextResponse.json(
      { error: "Authentication is not configured on this server." },
      { status: 503 }
    );
  }

  const path = request.nextUrl.pathname;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (path.startsWith("/report") && session.role !== "reporter") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    (path.startsWith("/dashboard") ||
      path.startsWith("/equipment")) &&
    session.role !== "technician"
  ) {
    return NextResponse.redirect(new URL("/report", request.url));
  }

  if (path.startsWith("/my-reports") && session.role !== "reporter") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/report/:path*", "/dashboard/:path*", "/equipment/:path*", "/my-reports/:path*", "/triage/:path*"],
};
