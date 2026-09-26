import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Dual-mode dev-only simulated payment. Guests authenticate with the
// x-order-access-token header; signed-in buyers take the cookie-forwarded
// Nest path (orders/:publicId/payment/test-complete). Nest enforces
// PAYMENT_MODE=test and refuses in production either way.
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-test-complete'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const guest = token.length > 0
  const nestPath = guest ? `${apiOrigin}/api/v1/public/orders/${publicId}/payment/test-complete` : `${apiOrigin}/api/v1/orders/${publicId}/payment/test-complete`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (guest) headers['x-order-access-token'] = token
  else headers.cookie = request.headers.get('cookie') ?? ''
  const response = await fetch(nestPath, { method: 'POST', headers })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
