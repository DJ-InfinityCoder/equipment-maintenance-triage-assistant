import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/auth/authorization";
import { AppError } from "@/lib/schemas/errors";
import { FollowUpAnswerSubmissionSchema } from "@/lib/schemas/triage-record";
import {
  asFollowUpDatabaseError,
  submitFollowUpAnswers,
} from "@/lib/services/followUpService";
import { checkRateLimit } from "@/lib/services/rateLimiter";
import { logServerEvent } from "@/lib/services/logger";

export const maxDuration = 90;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authorization = await authorizeRequest(request, ["reporter", "technician"]);
  if (!authorization.authorized) return authorization.response;

  const { id } = await context.params;
  const rateLimit = checkRateLimit(
    `follow-up:${authorization.session.id}:${id}`,
    5,
    5 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many follow-up submissions. Please wait before trying again." },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = FollowUpAnswerSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid follow-up answers.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await submitFollowUpAnswers(
      id,
      parsed.data.answers,
      authorization.session
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        { status: error.statusCode }
      );
    }
    const databaseError = asFollowUpDatabaseError(error);
    logServerEvent("error", "follow_up_answers_failed", {
      code: databaseError.code,
    });
    return NextResponse.json(
      { error: databaseError.userMessage, code: databaseError.code },
      { status: databaseError.statusCode }
    );
  }
}
