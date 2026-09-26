import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Authenticated order status proxy — Nest is canonical
// (GET /api/v1/orders/:publicId, ownership enforced via user_profile_id).
// Drives the live payment/cancel section on the account order detail page.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-status'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many status checks. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const response = await fetch(`${apiOrigin}/api/v1/orders/${publicId}`, { headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' }, cache: 'no-store' })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
