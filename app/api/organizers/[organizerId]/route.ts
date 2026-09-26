import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { organizerRenameInput, renameOrganizer } from '@/lib/organizer-settings'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'

function mapRenameError(error: unknown) {
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error instanceof Error && error.message === 'ORGANIZER_NOT_FOUND') return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  return null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'organizer-rename'), 10)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const parsed = organizerRenameInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid workspace name' }, { status: 400 })
    const organizer = await renameOrganizer(context, organizerId, parsed.data.name)
    return NextResponse.json({ organizer })
  } catch (error) {
    const mapped = mapRenameError(error)
    if (mapped) return mapped
    return NextResponse.json({ error: 'Unable to rename the workspace' }, { status: 500 })
  }
}
