import { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { createOrderInput, createProfileOrder, listOrdersForProfile } from '@/lib/server/orders'

// Authenticated order creation + list — Supabase-native (Pair 6).
// Atomicity lives in ticketug.create_order (migration 012): inventory FOR
// UPDATE, guarded decrement, price snapshots, idempotency. The session is
// resolved server-side (supabase.auth.getUser → user_profile); no bearer
// forwarding and no separately hosted API any more. Response shapes are
// byte-compatible with the previous Nest presenter.

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-create'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many order attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const context = await requireTicketUGContext()
    const parsed = createOrderInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 })
    const order = await createProfileOrder(context.profileId, parsed.data)
    return Response.json(order, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, 'order-status'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many status checks. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const context = await requireTicketUGContext()
    return Response.json(await listOrdersForProfile(context.profileId))
  } catch (error) {
    return apiErrorResponse(error)
  }
}
