import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { cancelOrderForProfile } from '@/lib/server/orders'

// Authenticated cancellation — Supabase-native (Pair 6). Inventory restore +
// payment teardown happen transactionally inside ticketug.cancel_order
// (ownership re-verified in SQL).
export async function PATCH(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-cancel'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many cancel attempts. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const auth = await requireTicketUGContext()
    const { publicId } = await context.params
    return Response.json(await cancelOrderForProfile(auth.profileId, publicId))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
