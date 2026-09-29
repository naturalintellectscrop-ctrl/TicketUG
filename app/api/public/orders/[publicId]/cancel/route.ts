import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { apiErrorResponse } from '@/lib/server/errors'
import { cancelOrderForGuest } from '@/lib/server/orders'

// Guest self-service cancellation (Pair 6, Supabase-native). Inventory restore
// + payment teardown happen transactionally inside ticketug.cancel_order with
// the sha256 token check re-verified in SQL.
export async function PATCH(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-cancel'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many cancel attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    return Response.json(await cancelOrderForGuest(publicId, token))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
