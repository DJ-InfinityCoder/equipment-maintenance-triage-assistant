import { NextRequest, NextResponse } from "next/server";
import { processTriageReport } from "@/lib/services/triageService";
import { checkRateLimit } from "@/lib/services/rateLimiter";
import { logServerEvent } from "@/lib/services/logger";
import { ValidationError, AppError } from "@/lib/schemas/errors";
import { authorizeRequest } from "@/lib/auth/authorization";

export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const authorization = await authorizeRequest(request, ["reporter"]);
  if (!authorization.authorized) return authorization.response;

  // 1. Client IP Extraction & Rate Limiting (10 req/min)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

  const rateCheck = checkRateLimit(clientIp, 10, 60 * 1000);
  if (!rateCheck.allowed) {
    logServerEvent("warn", "rate_limit_exceeded", {
      clientIp,
      resetAt: rateCheck.resetAt,
    });

    return NextResponse.json(
      {
        error: "Rate limit exceeded. Maximum 10 triage requests per minute.",
        statusCode: 429,
        resetAt: rateCheck.resetAt,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // 2. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch (parseErr) {
    logServerEvent("warn", "invalid_json_request_body", {
      clientIp,
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });

    return NextResponse.json(
      {
        error: "Malformed JSON payload.",
        statusCode: 400,
      },
      { status: 400 }
    );
  }

  const normalizedBody =
    body && typeof body === "object" && !Array.isArray(body)
      ? {
          ...body,
          reportedBy: authorization.session.name,
          reportedByUserId: authorization.session.id,
        }
      : body;

  // 3. Process Triage Pipeline
  try {
    const result = await processTriageReport(normalizedBody);

    return NextResponse.json(
      {
        triageId: result.triageId,
        workOrderId: result.workOrderId,
        status: result.status,
        finalPriority: result.record.finalPriority,
        ruleFloorPriority: result.record.ruleFloorPriority,
        createdAt: result.record.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          userMessage: error.userMessage,
          details: error.details,
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      logServerEvent("error", "triage_app_error", {
        code: error.code,
        userMessage: error.userMessage,
      });

      return NextResponse.json(
        {
          error: error.message,
          userMessage: error.userMessage,
          code: error.code,
          statusCode: error.statusCode,
        },
        { status: error.statusCode }
      );
    }

    const unhandledMsg = error instanceof Error ? error.message : String(error);
    logServerEvent("error", "unhandled_triage_error", { error: unhandledMsg });

    return NextResponse.json(
      {
        error: "Internal server error occurred while processing triage report.",
        statusCode: 500,
      },
      { status: 500 }
    );
  }
}
