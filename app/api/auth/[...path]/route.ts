import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const authHandlers = auth.handler()

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return authHandlers.GET(request, context)
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
  return authHandlers.POST(request, context)
}
