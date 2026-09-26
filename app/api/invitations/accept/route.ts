import { NextResponse } from 'next/server'
import { z } from 'zod'
import { acceptInvitation } from '@/lib/invitations'
import { requireTicketUGContext } from '@/lib/request-context'

const schema = z.object({ token: z.string().min(40).max(100) })

export async function POST(request: Request) {
  try {
    const context = await requireTicketUGContext()
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 })
    const membership = await acceptInvitation(context, parsed.data.token, context.authEmail)
    return NextResponse.json({ membership })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof Error && error.message === 'INVITATION_INVALID') return NextResponse.json({ error: 'Invitation is invalid or expired' }, { status: 400 })
    if (error instanceof Error && error.message === 'INVITATION_EMAIL_MISMATCH') return NextResponse.json({ error: 'This invitation was sent to a different email address. Sign in with the invited account.' }, { status: 403 })
    return NextResponse.json({ error: 'Unable to accept invitation' }, { status: 500 })
  }
}
