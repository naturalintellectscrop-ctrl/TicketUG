import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { getOrderForProfile } from '@/lib/server/orders'

// Authenticated order status — Supabase-native (Pair 6). Ownership enforced in
// the same SQL statement as the read; lazy expiry keeps payment windows honest.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-status'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many status checks. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const auth = await requireTicketUGContext()
    const { publicId } = await context.params
    return Response.json(await getOrderForProfile(auth.profileId, publicId))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
