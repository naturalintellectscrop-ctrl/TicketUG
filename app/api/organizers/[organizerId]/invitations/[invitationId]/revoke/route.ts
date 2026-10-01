import { NextResponse } from 'next/server'
import { revokeInvitation } from '@/lib/invitations'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

export async function PATCH(_request: Request, { params }: { params: Promise<{ organizerId: string; invitationId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(_request, 'invitation-revoke'), 20)
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const context = await requireTicketUGContext()
    const { organizerId, invitationId } = await params
    const result = await revokeInvitation(context, organizerId, invitationId)
    return NextResponse.json({ invitation: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof Error && error.message === 'INVITATION_INVALID') return NextResponse.json({ error: 'This invitation cannot be revoked — it was already accepted, revoked, or has expired.' }, { status: 400 })
    return NextResponse.json({ error: 'Unable to revoke invitation' }, { status: 500 })
  }
}
