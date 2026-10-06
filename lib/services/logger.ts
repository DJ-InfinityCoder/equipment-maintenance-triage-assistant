/**
 * Structured server logging without PII or secrets.
 * Non-negotiable rule 7: Never log secrets, API keys, or raw sensitive payloads.
 */

const REDACTED_KEYS = new Set([
  "apikey",
  "api_key",
  "secret",
  "password",
  "token",
  "authorization",
  "cookie",
  "credential",
  "accesstoken",
  "gemini_api_key",
  "mongodb_uri",
]);

/**
 * Recursively redacts sensitive values from log metadata objects.
 */
export function sanitizeLogMetadata(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
    if (REDACTED_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}... [truncated]`;
    } else {
      sanitized[key] = sanitizeLogMetadata(value, depth + 1);
    }
  }

  return sanitized;
}

export type LogLevel = "info" | "warn" | "error";

/**
 * Emits a structured JSON log entry to stdout / stderr.
 */
export function logServerEvent(
  level: LogLevel,
  event: string,
  meta?: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(meta ? (sanitizeLogMetadata(meta) as Record<string, unknown>) : {}),
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}
