import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { apiErrorResponse } from '@/lib/server/errors'
import { getOrderForGuest } from '@/lib/server/orders'

// Guest order status (Pair 6, Supabase-native). The access token is
// sha256-compared inside the SQL read against guest_access_token_hash; lazy
// expiry keeps lapsed reservations honest.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-status'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many status checks. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    return Response.json(await getOrderForGuest(publicId, token))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
