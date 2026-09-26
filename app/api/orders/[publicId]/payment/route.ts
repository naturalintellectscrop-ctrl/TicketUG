import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

// Dual-mode payment proxy. Nest has two canonical surfaces for the same
// operations: guest orders authenticate with the x-order-access-token header
// (public/orders/…), signed-in orders with the session cookie (orders/…).
// When the token header is present we take the guest path exactly as before;
// otherwise the session cookie is forwarded and the Nest guard authenticates
// the account owner.
async function forward(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-payment'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many payment requests. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const { publicId } = await context.params
  const token = request.headers.get('x-order-access-token') ?? ''
  const guest = token.length > 0
  const nestPath = guest ? `${apiOrigin}/api/v1/public/orders/${publicId}/payment` : `${apiOrigin}/api/v1/orders/${publicId}/payment`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (guest) headers['x-order-access-token'] = token
  else headers.cookie = request.headers.get('cookie') ?? ''
  const init: RequestInit = { method: request.method, headers, cache: 'no-store' }
  if (request.method !== 'GET') init.body = await request.text()
  const response = await fetch(nestPath, init)
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return forward(request, context) }
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return forward(request, context) }
