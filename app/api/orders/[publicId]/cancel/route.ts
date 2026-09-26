import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Authenticated cancellation proxy — Nest is canonical
// (PATCH /api/v1/orders/:publicId/cancel, ownership enforced server-side;
// inventory restore + payment teardown happen transactionally in Nest).
export async function PATCH(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-cancel'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many cancel attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const response = await fetch(`${apiOrigin}/api/v1/orders/${publicId}/cancel`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' } })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
