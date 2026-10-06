import { NextRequest, NextResponse } from "next/server";
import { ensureDemoUser, ensureUsersIndex, findUserByEmail } from "@/lib/db/repos/users";
import { LoginUserInputSchema } from "@/lib/schemas/user";
import {
  assertAuthConfigured,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    assertAuthConfigured();
    const body = await request.json();
    const parsed = LoginUserInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await ensureUsersIndex();
    let user = await ensureDemoUser(parsed.data.email, parsed.data.password);
    if (!user) {
      user = await findUserByEmail(parsed.data.email);
    }

    if (!user || !verifyPassword(parsed.data.password, user.passwordSalt, user.passwordHash)) {
      return NextResponse.json(
        {
          error: "Invalid email or password.",
          statusCode: 401,
        },
        { status: 401 }
      );
    }

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
    if (error instanceof Error && error.name === "AuthConfigurationError") {
      return NextResponse.json(
        { error: "Authentication is not configured. Set AUTH_SECRET to a random value of at least 32 characters." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Unable to sign in. Please try again.", statusCode: 500 },
      { status: 500 }
    );
  }
}
