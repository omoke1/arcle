import { kv } from "@vercel/kv";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/**
 * Simple sliding-window rate limiter using Vercel KV.
 *
 * - key: stable identifier (e.g. "chat:ip", "circle-tx:ip")
 * - limit: max requests per window
 * - windowSeconds: window size in seconds
 *
 * In local/dev environments where Vercel KV isn't configured, this
 * function will **gracefully bypass** rate limiting so the app still works.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const hasKvEnv =
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

  // If KV isn't configured (local dev, tests), bypass rate limiting
  if (!hasKvEnv) {
    const now = Date.now();
    return {
      allowed: true,
      remaining: limit,
      reset: Math.floor(now / 1000) + windowSeconds,
    };
  }

  const now = Date.now();
  const windowId = Math.floor(now / (windowSeconds * 1000));
  const redisKey = `ratelimit:${key}:${windowId}`;

  const current = await kv.incr(redisKey);
  if (current === 1) {
    // First hit in this window – set expiry
    await kv.expire(redisKey, windowSeconds);
  }

  const allowed = current <= limit;
  const remaining = Math.max(0, limit - current);
  const reset = windowId * windowSeconds + windowSeconds;

  return { allowed, remaining, reset };
}


