import { NextResponse } from 'next/server'
import { createInvitation, invitationInput, listInvitations } from '@/lib/invitations'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

export async function GET(_request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const invitations = await listInvitations(context, organizerId)
    return NextResponse.json({ invitations })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Unable to list invitations' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'invitation-create'), 10)
  if (!limited.allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const parsed = invitationInput.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
    const invitation = await createInvitation(context, organizerId, parsed.data)
    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Unable to create invitation' }, { status: 500 })
  }
}
