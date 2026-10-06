import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureUsersIndex, createUser } from "@/lib/db/repos/users";
import { RegisterUserInputSchema } from "@/lib/schemas/user";
import {
  assertAuthConfigured,
  AuthConfigurationError,
  createPasswordHash,
  setSessionCookie,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    assertAuthConfigured();
    const body = await request.json();
    const parsed = RegisterUserInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (parsed.data.role === "technician") {
      const inviteCode = process.env.TECHNICIAN_INVITE_CODE;
      if (!inviteCode || Buffer.byteLength(inviteCode) < 16) {
        return NextResponse.json(
          { error: "Technician account registration is not configured." },
          { status: 503 }
        );
      }
      const submittedCode = Buffer.from(parsed.data.technicianInviteCode ?? "");
      const configuredCode = Buffer.from(inviteCode);
      if (
        submittedCode.length !== configuredCode.length ||
        !crypto.timingSafeEqual(submittedCode, configuredCode)
      ) {
        return NextResponse.json(
          { error: "A valid technician invitation code is required." },
          { status: 403 }
        );
      }
    }

    await ensureUsersIndex();

    const password = createPasswordHash(parsed.data.password);
    const user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      role: parsed.data.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    await setSessionCookie(response, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: "Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters." },
        { status: 503 }
      );
    }
    const status =
      error instanceof Error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode ?? 500)
        : 500;

    return NextResponse.json(
      {
        error:
          status === 409
            ? "An account with this email already exists."
            : "Unable to create the account. Please try again.",
        statusCode: status,
      },
      { status }
    );
  }
}
