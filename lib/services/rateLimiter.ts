/**
 * Lightweight in-memory rate limiter per IP address.
 * Defaults to 10 requests per minute.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, RateLimitEntry>();

// Purge expired IP entries every 5 minutes to prevent memory leaks
const PURGE_INTERVAL_MS = 5 * 60 * 1000;
let lastPurge = Date.now();

function purgeExpiredEntries(now: number): void {
  if (now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  for (const [ip, entry] of ipBuckets.entries()) {
    if (now >= entry.resetAt) {
      ipBuckets.delete(ip);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

/**
 * Checks and increments request counter for a client IP.
 * @param ip Client IP address
 * @param limit Maximum allowed requests per window (default 10)
 * @param windowMs Window duration in milliseconds (default 60,000ms / 1 min)
 */
export function checkRateLimit(
  ip: string,
  limit = 10,
  windowMs = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  purgeExpiredEntries(now);

  const key = ip.trim() || "unknown-ip";
  const entry = ipBuckets.get(key);

  if (!entry || now >= entry.resetAt) {
    // New or reset window
    const resetAt = now + windowMs;
    ipBuckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      total: limit,
    };
  }

  // Active window
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      total: limit,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    total: limit,
  };
}

/**
 * Resets all rate limit tracking buckets (useful for test isolation).
 */
export function resetRateLimiter(): void {
  ipBuckets.clear();
  lastPurge = Date.now();
}
