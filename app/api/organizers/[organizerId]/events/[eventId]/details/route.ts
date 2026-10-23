import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { isApiAuthError, apiErrorResponse } from '@/lib/server/errors'
import { updateEventDetails } from '@/lib/server/events'

const detailsSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(5000),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().regex(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/).optional(),
})

// Event details update (spec §5.2.2). Ownership, lifecycle editability and
// the owner/manager gate live in lib/server/events.ts — this route only
// validates shape and rate-limits.
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'event-details'), 30)
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const auth = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    const parsed = detailsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid event details' }, { status: 400 })
    return NextResponse.json(await updateEventDetails(auth.profileId, organizerId, eventId, parsed.data))
  } catch (error) {
    if (isApiAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return apiErrorResponse(error)
  }
}
