import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { apiErrorResponse } from '@/lib/server/errors'
import { createGuestOrder } from '@/lib/server/orders'

// Guest checkout (Pair 6, Supabase-native). Response shape mirrors the
// canonical presenter (camelCase; the order form consumes publicId/orderNumber/
// paymentExpiresAt/guestAccessToken). Atomicity lives in ticketug.create_order
// (inventory FOR UPDATE + guarded decrement + snapshots + idempotency); the
// guest access token is minted here and only its sha256 reaches the database.
const payload = z.object({ items: z.array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().positive().max(100) })).min(1).superRefine((items, context) => { const ids = new Set<string>(); for (const item of items) { if (ids.has(item.ticketTypeId)) context.addIssue({ code: 'custom', message: 'Each ticket type may appear once per order' }); ids.add(item.ticketTypeId) } }), purchaserName: z.string().trim().min(1).max(180), purchaserEmail: z.string().email().max(320), idempotencyKey: z.string().max(128).optional() })

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, 'guest-order-create'), 10)
  if (!limited.allowed) return Response.json({ message: 'Too many order attempts. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  const parsed = payload.safeParse(await request.json())
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 })
  try {
    return Response.json(await createGuestOrder(parsed.data), { status: 201 })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
