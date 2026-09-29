import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { credentialFromPayload, listAssignedEvents, scanCheckIn } from '@/lib/server/check-ins'

// Scanner surface (Pair 6, Supabase-native). The decisions live in
// lib/server/check-ins.ts — the same module the behavioral harness exercises.
// Gate scope comes from the staff member's ACTIVE assignment row (never from
// the request body); the check-in mutation is a single transaction.
export async function GET() {
  try {
    const context = await requireTicketUGContext()
    return NextResponse.json({ events: await listAssignedEvents(context.profileId) })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireTicketUGContext()
    const body = (await request.json()) as { eventId?: string; payload?: string }
    if (!body.eventId || !credentialFromPayload(body.payload)) {
      return NextResponse.json({ outcome: 'INVALID_QR' }, { status: 400 })
    }
    const result = await scanCheckIn(context.profileId, body.eventId, String(body.payload))
    const status = result.outcome === 'UNAUTHORIZED_SCANNER' || result.outcome === 'EVENT_NOT_AVAILABLE' ? 403 : 200
    return NextResponse.json(result, { status })
  } catch {
    return NextResponse.json({ outcome: 'VERIFICATION_UNAVAILABLE' }, { status: 503 })
  }
}
