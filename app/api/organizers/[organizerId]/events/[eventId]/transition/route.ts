import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

const transitionSchema = z.object({ to: z.string().min(1).max(40) })

// Thin compatibility client for the canonical NestJS transition endpoint
// (ADR-0004): authorization and the lifecycle state machine live entirely in
// apps/api; the web layer only forwards the session cookie.
export async function POST(request: NextRequest, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { eventId } = await params
  const parsed = transitionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid transition request' }, { status: 400 })
  const response = await fetch(`${apiOrigin}/api/v1/events/${eventId}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify(parsed.data),
  })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
