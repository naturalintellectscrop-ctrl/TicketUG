import { NextResponse } from 'next/server'
import { revokeInvitation } from '@/lib/invitations'
import { requireTicketUGContext } from '@/lib/request-context'

export async function PATCH(_request: Request, { params }: { params: Promise<{ organizerId: string; invitationId: string }> }) {
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
