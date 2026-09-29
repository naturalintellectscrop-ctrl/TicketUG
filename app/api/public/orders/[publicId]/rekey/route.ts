import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { apiErrorResponse } from '@/lib/server/errors'
import { rekeyGuestOrder } from '@/lib/server/orders'

// Access-key rotation (Pair 6, Supabase-native). Requires the CURRENT valid
// token; returns a fresh one and invalidates every earlier link.
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-rekey'), 5)
  if (!limited.allowed) return Response.json({ message: 'Too many key-reset attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    return Response.json(await rekeyGuestOrder(publicId, token))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
