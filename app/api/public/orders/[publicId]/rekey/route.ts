import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Access-key rotation proxy — Nest is canonical
// (POST /api/v1/public/orders/:publicId/rekey). Requires the CURRENT valid
// token; returns a fresh one and invalidates every earlier link. Strict rate
// limit because rotation is a credential operation.
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-rekey'), 5)
  if (!limited.allowed) return Response.json({ message: 'Too many key-reset attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const response = await fetch(`${apiOrigin}/api/v1/public/orders/${publicId}/rekey`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-order-access-token': token }, body: '{}' })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
