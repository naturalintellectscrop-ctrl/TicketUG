import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Guest order status proxy — Nest is canonical (GET /api/v1/public/orders/:publicId).
// The access token is sha256-compared server side against guest_access_token_hash.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-status'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many status checks. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}`, { headers: { 'content-type': 'application/json', 'x-order-access-token': token }, cache: 'no-store' })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
