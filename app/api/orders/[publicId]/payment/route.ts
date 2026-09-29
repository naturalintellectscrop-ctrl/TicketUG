import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { requireTicketUGContext } from '@/lib/request-context'
import { apiErrorResponse } from '@/lib/server/errors'
import { initiatePayment, paymentStatus } from '@/lib/server/payments'
import { hashGuestToken } from '@/lib/server/orders'

// Dual-mode payment surface (Pair 6, Supabase-native). Guest orders
// authenticate with the x-order-access-token header (sha256-compared in SQL);
// signed-in orders use the server-resolved session. Same URLs, methods, rate
// limits and response shapes as before — without the separately hosted API.

const bodySchema = z.object({ idempotencyKey: z.string().min(16).max(128), provider: z.string().max(100).optional() })

async function handle(request: NextRequest, context: { params: Promise<{ publicId: string }> }, mode: 'POST' | 'GET') {
  const limited = checkRateLimit(rateLimitKey(request, 'order-payment'), 30)
  if (!limited.allowed) return Response.json({ message: 'Too many payment requests. Please wait a minute.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const { publicId } = await context.params
    const token = request.headers.get('x-order-access-token') ?? ''
    const guest = token.length > 0
    const actor = guest ? { guestTokenHash: hashGuestToken(token) } : { profileId: (await requireTicketUGContext()).profileId }
    if (mode === 'POST') {
      const parsed = bodySchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? 'Invalid payment request' }, { status: 400 })
      return Response.json(await initiatePayment(actor, publicId, parsed.data))
    }
    return Response.json(await paymentStatus(actor, publicId))
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return Response.json({ message: 'Authentication required' }, { status: 401 })
    return apiErrorResponse(error)
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return handle(request, context, 'GET') }
export async function POST(request: NextRequest, context: { params: Promise<{ publicId: string }> }) { return handle(request, context, 'POST') }
