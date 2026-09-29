import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { apiErrorResponse } from '@/lib/server/errors'
import { listTicketsForGuest } from '@/lib/server/tickets'

// Guest ticket list (Pair 6, Supabase-native). Token compared inside the SQL
// read; returns the issued tickets for the token-bearing order.
export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-tickets'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many requests. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    return Response.json(await listTicketsForGuest(publicId, token))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
