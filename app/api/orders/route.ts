import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Authenticated order creation proxy — Nest is canonical
// (POST /api/v1/orders). The session cookie is forwarded and validated by the
// Nest guard; the order attaches to the signed-in user's user_profile_id.
export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-create'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many order attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const response = await fetch(`${apiOrigin}/api/v1/orders`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' }, body: await request.text() })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
