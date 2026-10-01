import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { isApiAuthError, apiErrorResponse } from '@/lib/server/errors'
import { transitionEvent } from '@/lib/server/events'

const transitionSchema = z.object({ to: z.string().min(1).max(40) })

// Event lifecycle transition (Pair 6, Supabase-native). The state machine is
// enforced in lib/server/events.ts AND re-verified inside the guarded atomic
// UPDATE in ticketug.transition_event_lifecycle — no separately hosted API.
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'event-transition'), 30)
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const auth = await requireTicketUGContext()
    const { eventId } = await params
    const parsed = transitionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid transition request' }, { status: 400 })
    return NextResponse.json(await transitionEvent(auth.profileId, eventId, parsed.data.to))
  } catch (error) {
    if (isApiAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
