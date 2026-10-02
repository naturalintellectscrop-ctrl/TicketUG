/**
 * Per-key rate limiting for the developer API — fixed-window counters keyed
 * by the authenticated API key id (NOT by IP: one key may legitimately serve
 * a server-side integration).
 *
 * Deployment honesty: like lib/rate-limit.ts this is a process-local Map. On
 * Vercel's serverless runtime every warm instance enforces the window
 * independently, so the effective ceiling per key is `limit × warm instances`
 * and counters reset on cold starts. The limit below is documented as
 * enforced per server instance on /developers; the 429 behaviour and headers
 * themselves are real and always active on every instance.
 */

export const API_RATE_LIMIT = 120
export const API_RATE_WINDOW_MS = 60_000

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const PRUNE_THRESHOLD = 5_000

export type ApiRateResult = {
  allowed: boolean
  limit: number
  remaining: number
  /** Unix seconds when the current window resets (for X-RateLimit-Reset). */
  resetAtSec: number
  /** Seconds until the window resets; only set when the request was blocked. */
  retryAfterSec?: number
}

export function checkApiKeyRateLimit(keyId: string, now = Date.now(), limit = API_RATE_LIMIT, windowMs = API_RATE_WINDOW_MS): ApiRateResult {
  if (buckets.size > PRUNE_THRESHOLD) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey)
    }
  }
  const current = buckets.get(keyId)
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(keyId, { count: 1, resetAt })
    return { allowed: true, limit, remaining: limit - 1, resetAtSec: Math.ceil(resetAt / 1000) }
  }
  if (current.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAtSec: Math.ceil(current.resetAt / 1000), retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }
  current.count += 1
  return { allowed: true, limit, remaining: limit - current.count, resetAtSec: Math.ceil(current.resetAt / 1000) }
}

/** Standard-ish rate limit headers sent on EVERY /api/v1 response so clients
 * can pace themselves without probing. */
export function apiKeyRateHeaders(result: ApiRateResult): Record<string, string> {
  const headers: Record<string, string> = {
    'x-ratelimit-limit': String(result.limit),
    'x-ratelimit-remaining': String(result.remaining),
    'x-ratelimit-reset': String(result.resetAtSec),
  }
  if (result.retryAfterSec !== undefined) headers['retry-after'] = String(result.retryAfterSec)
  return headers
}
