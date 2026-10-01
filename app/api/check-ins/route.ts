import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { credentialFromPayload, listAssignedEvents, scanCheckIn } from '@/lib/server/check-ins'
import { isApiAuthError } from '@/lib/server/errors'

// Scanner surface (Pair 6, Supabase-native). The decisions live in
// lib/server/check-ins.ts — the same module the behavioral harness exercises.
// Gate scope comes from the staff member's ACTIVE assignment row (never from
// the request body); the check-in mutation is a single transaction.
export async function GET() {
  try {
    const context = await requireTicketUGContext()
    return NextResponse.json({ events: await listAssignedEvents(context.profileId) })
  } catch (error) {
    // Only a missing/invalid session is 401 — a storage/Auth outage must not
    // tell a logged-in scanner they are unauthorized.
    if (isApiAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Verification unavailable' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  // Abuse surface: this endpoint answers "is this QR valid?" — rate-limit per
  // scanner IP. The limit is generous (real gates scan in bursts) but bounded:
  // credentials are high-entropy, so this is brute-force resistance, not the
  // primary control.
  const limited = checkRateLimit(rateLimitKey(request, 'scan-check-in'), 120, 60_000)
  if (!limited.allowed) {
    return NextResponse.json({ outcome: 'VERIFICATION_UNAVAILABLE' }, { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } })
  }
  try {
    const context = await requireTicketUGContext()
    const body = (await request.json()) as { eventId?: string; payload?: string }
    if (!body.eventId || !credentialFromPayload(body.payload)) {
      return NextResponse.json({ outcome: 'INVALID_QR' }, { status: 400 })
    }
    const result = await scanCheckIn(context.profileId, body.eventId, String(body.payload))
    const status = result.outcome === 'UNAUTHORIZED_SCANNER' || result.outcome === 'EVENT_NOT_AVAILABLE' ? 403 : 200
    return NextResponse.json(result, { status })
  } catch (error) {
    if (isApiAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ outcome: 'VERIFICATION_UNAVAILABLE' }, { status: 503 })
  }
}
