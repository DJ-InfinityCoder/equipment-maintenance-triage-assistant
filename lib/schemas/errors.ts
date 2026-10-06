import { z } from "zod";

/**
 * Standard AI failure subcategories.
 */
export const AiErrorSubtypeSchema = z.enum([
  "timeout",
  "rate_limit",
  "invalid_output",
  "blocked",
  "unavailable",
  "configuration",
]);

export type AiErrorSubtype = z.infer<typeof AiErrorSubtypeSchema>;

/**
 * Serialized representation of an AppError suitable for client-side display in UI banners.
 * Non-negotiable rule 6: Failures surface as typed errors and a visible UI banner.
 * Non-negotiable rule 7: Never log secrets or expose raw sensitive payload internals.
 */
export const SerializedAppErrorSchema = z.object({
  code: z.string(),
  userMessage: z.string(),
  statusCode: z.number(),
  subtype: AiErrorSubtypeSchema.optional(),
  details: z.unknown().optional(),
});

export type SerializedAppError = z.infer<typeof SerializedAppErrorSchema>;

/**
 * Base domain application error.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  readonly userMessage: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      userMessage: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = options.userMessage;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): SerializedAppError {
    return {
      code: this.code,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Raised when input validation fails at the API boundary or internal schema check.
 */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(
    message: string,
    options?: {
      userMessage?: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, {
      userMessage:
        options?.userMessage ??
        "Input validation failed. Please review the highlighted fields.",
      statusCode: options?.statusCode ?? 400,
      details: options?.details,
      cause: options?.cause,
    });
  }
}

/**
 * Raised when a state machine transition is invalid (e.g. modifying an already approved or rejected work order).
 */
export class ConflictError extends AppError {
  readonly code = "CONFLICT_ERROR" as const;

  constructor(
    message: string,
    options?: {
      userMessage?: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, {
      userMessage:
        options?.userMessage ??
        "State conflict: The work order has already been finalized and cannot be modified.",
      statusCode: options?.statusCode ?? 409,
      details: options?.details,
      cause: options?.cause,
    });
  }
}

/**
 * Raised when MongoDB operations encounter connection, query, or transaction errors.
 */
export class DatabaseError extends AppError {
  readonly code = "DATABASE_ERROR" as const;

  constructor(
    message: string,
    options?: {
      userMessage?: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, {
      userMessage:
        options?.userMessage ??
        "Database operation failed. Telemetry and records could not be updated.",
      statusCode: options?.statusCode ?? 500,
      details: options?.details,
      cause: options?.cause,
    });
  }
}

/**
 * Raised when knowledge base retrieval (vector or lexical search) fails.
 */
export class RetrievalError extends AppError {
  readonly code = "RETRIEVAL_ERROR" as const;

  constructor(
    message: string,
    options?: {
      userMessage?: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, {
      userMessage:
        options?.userMessage ??
        "Knowledge base retrieval failed. Equipment manuals could not be referenced.",
      statusCode: options?.statusCode ?? 500,
      details: options?.details,
      cause: options?.cause,
    });
  }
}

/**
 * Raised when Gemini AI encounters rate limits, timeouts, blocked filters, or invalid outputs.
 */
export class AiError extends AppError {
  readonly code = "AI_ERROR" as const;
  readonly subtype: AiErrorSubtype;

  constructor(
    message: string,
    options: {
      subtype: AiErrorSubtype;
      userMessage?: string;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    const statusCodeMap: Record<AiErrorSubtype, number> = {
      timeout: 504,
      rate_limit: 429,
      invalid_output: 502,
      blocked: 400,
      unavailable: 503,
      configuration: 500,
    };

    const defaultUserMessages: Record<AiErrorSubtype, string> = {
      timeout: "AI generation exceeded the response deadline. Deterministic safety rules remain enforced.",
      rate_limit:
        "Rate limit exceeded (429): AI service quota temporarily exceeded. Please try again shortly.",
      invalid_output: "Malformed JSON / Invalid output: AI response could not be parsed as valid JSON schema. Manual review required.",
      blocked: "Content blocked: The triage prompt or safety filters blocked AI generation. Manual review required.",
      unavailable: "The configured AI service is temporarily unavailable or experiencing high load. Please retry shortly.",
      configuration:
        "AI provider configuration is missing or invalid. Check AI_PROVIDER and the API key/model environment variables for each provider you want enabled.",
    };

    super(message, {
      userMessage: options.userMessage ?? defaultUserMessages[options.subtype],
      statusCode: statusCodeMap[options.subtype],
      details: options.details,
      cause: options.cause,
    });

    this.subtype = options.subtype;
  }

  override toJSON(): SerializedAppError {
    return {
      ...super.toJSON(),
      subtype: this.subtype,
    };
  }
}

/**
 * Normalizes any unknown thrown error into a typed AppError instance.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new ValidationError("Schema validation error", {
      details: error.flatten(),
      cause: error,
    });
  }
  if (error instanceof Error) {
    return new DatabaseError(error.message, { cause: error });
  }
  return new DatabaseError("An unexpected server error occurred", {
    details: String(error),
  });
}
