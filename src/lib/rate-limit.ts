import crypto from "crypto";

// Global Distributed Rate Limiter (Upstash Redis REST + In-Memory Fallback)
// Uses Upstash Redis REST API when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// are set, sharing rate-limit counters across all Vercel serverless instances.
// Falls back to an in-memory sliding window when Redis env vars are absent.

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

function checkMemoryRateLimit(
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

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return checkMemoryRateLimit(key, limit, windowMs);
  }

  const redisKey = `rl:${key}`;
  try {
    const res = await fetch(`${redisUrl.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PTTL", redisKey]
      ]),
      cache: "no-store"
    });

    if (!res.ok) {
      return checkMemoryRateLimit(key, limit, windowMs);
    }

    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 1);
    let pttl = Number(data?.[1]?.result ?? -1);

    if (count === 1 || pttl < 0) {
      await fetch(
        `${redisUrl.replace(/\/$/, "")}/pexpire/${encodeURIComponent(
          redisKey
        )}/${windowMs}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${redisToken}` },
          cache: "no-store"
        }
      );
      pttl = windowMs;
    }

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(pttl / 1000))
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: 0
    };
  } catch {
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip || "127.0.0.1").digest("hex");
}