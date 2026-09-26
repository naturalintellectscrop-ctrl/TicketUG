import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTicketUGContext } from '@/lib/request-context'
import { transferOwnership } from '@/lib/members'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

const transferInput = z.object({
  memberId: z.string().uuid(),
})

function mapTransferError(error: unknown) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error instanceof Error && error.message === 'MEMBER_NOT_FOUND') return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (error instanceof Error && error.message === 'TARGET_OWNS_ORGANIZER') return NextResponse.json({ error: 'That member already owns another workspace.' }, { status: 409 })
  return null
}

export async function POST(request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'ownership-transfer'), 10)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const parsed = transferInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid ownership transfer' }, { status: 400 })
    const result = await transferOwnership(context, organizerId, parsed.data.memberId)
    return NextResponse.json({ transfer: result })
  } catch (error) {
    const mapped = mapTransferError(error)
    if (mapped) return mapped
    return NextResponse.json({ error: 'Unable to transfer ownership' }, { status: 500 })
  }
}
