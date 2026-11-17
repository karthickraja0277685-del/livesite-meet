import crypto from "crypto";

// Concept: Sliding-Window Rate Limiter
// Prevents abuse (spamming waitlist signups, creating hundreds of meetings, or flooding uploads).
interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets: Map<string, Bucket> | undefined;
};

const buckets: Map<string, Bucket> =
  globalForRateLimit.rateLimitBuckets ?? new Map<string, Bucket>();

if (!globalForRateLimit.rateLimitBuckets) {
  globalForRateLimit.rateLimitBuckets = buckets;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0
  };
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip || "127.0.0.1").digest("hex");
}