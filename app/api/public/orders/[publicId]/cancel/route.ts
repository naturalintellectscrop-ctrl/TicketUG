import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Guest self-service cancellation proxy — Nest is canonical
// (PATCH /api/v1/public/orders/:publicId/cancel). Write endpoint: strict rate
// limit. Inventory restore + payment teardown happen transactionally in Nest.
export async function PATCH(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-cancel'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many cancel attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}/cancel`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-order-access-token': token }, body: await request.text() })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
