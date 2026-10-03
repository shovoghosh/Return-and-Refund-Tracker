/**
 * In-process sliding-window rate limiter. Single-instance deployments only; a
 * multi-instance deployment must swap the store for Redis/Upstash. Used on
 * sign-in, sign-up, and upload endpoints.
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Test helper: clears all windows. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client identifier for rate limiting (never trusted for auth). */
export function clientKey(headers: Headers, scope: string, subject = ""): string {
  const fwd = headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
  return `${scope}:${ip}:${subject}`;
}
