import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { simulateTestSuccess } from '@/lib/server/payments'
import { hashGuestToken } from '@/lib/server/orders'

// Dual-mode dev-only simulated payment (Pair 6, Supabase-native). Guests use
// the x-order-access-token header; signed-in buyers use the session. The
// production gate (NODE_ENV=production or PAYMENT_MODE≠test → 503
// TEST_PAYMENT_DISABLED) runs FIRST and is fail-closed — unchanged from the
// removed NestJS implementation.
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-test-complete'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    const actor = token.length > 0 ? { guestTokenHash: hashGuestToken(token) } : { profileId: (await requireTicketUGContext()).profileId }
    return Response.json(await simulateTestSuccess(actor, publicId))
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return Response.json({ message: 'Authentication required' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
