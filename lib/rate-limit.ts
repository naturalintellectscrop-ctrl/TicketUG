type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function checkRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (current.count >= limit) return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now }
  current.count += 1
  return { allowed: true, remaining: limit - current.count }
}

export function rateLimitKey(request: Request, scope: string) {
  return `${scope}:${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`
}

// This process-local fallback is safe for development only. Production deployments must replace it with a distributed limiter.
