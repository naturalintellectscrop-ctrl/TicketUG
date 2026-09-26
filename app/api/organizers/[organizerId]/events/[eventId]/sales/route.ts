import { NextResponse } from 'next/server'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { requireTicketUGContext } from '@/lib/request-context'
import { loadEventSalesMetrics } from '@/lib/event-sales-metrics'
import { pool } from '@/lib/db'

type RouteContext = { params: Promise<{ organizerId: string; eventId: string }> }

async function loadEvent(organizerId: string, eventId: string) {
  return (await pool.query('SELECT id FROM ticketug.event WHERE id = $1 AND organizer_id = $2', [eventId, organizerId])).rows[0] ?? null
}

// Aggregate sales metrics only — no attendee PII is returned (Master Spec §19).
export async function GET(_: Request, { params }: RouteContext) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await loadEvent(organizerId, eventId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const metrics = await loadEventSalesMetrics(eventId)
    return NextResponse.json({ metrics })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to load event sales metrics' }, { status: 500 })
  }
}
