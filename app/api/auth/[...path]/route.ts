import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

// Handlers are created on first request, not at module scope: `next build`
// imports this module during page-data collection, and constructing the auth
// client there failed deployments before any request could ever be served.
// Same fail-closed contract as lib/auth.ts — without a valid production
// secret the first auth request throws loudly; the build itself does not.
type AuthHandlers = ReturnType<ReturnType<typeof getAuth>['handler']>

let cachedHandlers: AuthHandlers | null = null

function getHandlers(): AuthHandlers {
  if (!cachedHandlers) cachedHandlers = getAuth().handler()
  return cachedHandlers
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return getHandlers().GET(request, context)
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = new URL(request.url).pathname
  const sensitive = /sign-in|sign-up|forget-password|reset-password|change-password/.test(path)
  if (sensitive) {
    const result = checkRateLimit(rateLimitKey(request, path), 10, 60_000)
    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'retry-after': String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000)) } },
      )
    }
  }
  return getHandlers().POST(request, context)
}
