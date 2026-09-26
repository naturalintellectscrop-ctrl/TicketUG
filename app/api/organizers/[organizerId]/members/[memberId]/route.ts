import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { changeMemberRole, memberRoleInput, removeMember } from '@/lib/members'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ organizerId: string; memberId: string }> }

function tooManyRequests(request: Request, scope: string) {
  const limited = checkRateLimit(rateLimitKey(request, scope), 10)
  if (limited.allowed) return null
  return NextResponse.json(
    { error: 'Too many requests. Try again shortly.' },
    { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
  )
}

function mapMemberError(error: unknown) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error instanceof Error && error.message === 'MEMBER_NOT_FOUND') return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (error instanceof Error && error.message === 'LAST_OWNER') return NextResponse.json({ error: 'The workspace must keep at least one owner.' }, { status: 409 })
  if (error instanceof Error && error.message === 'OWNER_CANNOT_LEAVE') return NextResponse.json({ error: 'The workspace owner cannot leave yet — ownership transfer is not available.' }, { status: 409 })
  return null
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const limited = tooManyRequests(request, 'member-role-change')
  if (limited) return limited
  try {
    const context = await requireTicketUGContext()
    const { organizerId, memberId } = await params
    const parsed = memberRoleInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid role change' }, { status: 400 })
    const result = await changeMemberRole(context, organizerId, memberId, parsed.data.role)
    return NextResponse.json({ member: result.member })
  } catch (error) {
    const mapped = mapMemberError(error)
    if (mapped) return mapped
    return NextResponse.json({ error: 'Unable to change the member role' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const limited = tooManyRequests(request, 'member-remove')
  if (limited) return limited
  try {
    const context = await requireTicketUGContext()
    const { organizerId, memberId } = await params
    const result = await removeMember(context, organizerId, memberId)
    return NextResponse.json({ member: result })
  } catch (error) {
    const mapped = mapMemberError(error)
    if (mapped) return mapped
    return NextResponse.json({ error: 'Unable to remove the member' }, { status: 500 })
  }
}
