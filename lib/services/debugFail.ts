import { RetrievalError, AiError, DatabaseError } from "../schemas/errors";

export type DebugFailType = "retrieval" | "ai" | "db";

/**
 * Dev-only simulation helper to quickly trigger failure paths.
 * STRICTLY GUARDED: Will never activate when NODE_ENV === "production".
 */
export function getDebugFail(): DebugFailType | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const val = process.env.DEBUG_FAIL?.trim().toLowerCase();
  if (val === "retrieval" || val === "ai" || val === "db") {
    return val;
  }
  return null;
}

/**
 * Checks if a specific failure type is requested in dev mode.
 */
export function isDebugFailActive(type: DebugFailType): boolean {
  return getDebugFail() === type;
}

/**
 * Throws a simulated error if the given failure mode is configured in dev.
 */
export function checkAndThrowDebugFail(stage: DebugFailType): void {
  if (!isDebugFailActive(stage)) {
    return;
  }

  switch (stage) {
    case "retrieval":
      throw new RetrievalError("Simulated knowledge base retrieval failure (DEBUG_FAIL=retrieval)", {
        userMessage: "Knowledge base retrieval failed via dev debug toggle.",
      });
    case "ai":
      throw new AiError("Simulated Gemini AI failure (DEBUG_FAIL=ai)", {
        subtype: "unavailable",
        userMessage: "Simulated Gemini 503 unavailable failure via dev debug toggle.",
      });
    case "db":
      throw new DatabaseError("Simulated MongoDB database failure (DEBUG_FAIL=db)", {
        userMessage: "Database connection failed via dev debug toggle.",
      });
  }
}
