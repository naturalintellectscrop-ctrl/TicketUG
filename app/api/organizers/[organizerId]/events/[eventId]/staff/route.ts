import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { staffAssignmentSchema } from '@/lib/gates'
import { requireTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

type RouteContext = { params: Promise<{ organizerId: string; eventId: string }> }

async function loadEvent(organizerId: string, eventId: string) {
  return (await pool.query('SELECT id FROM ticketug.event WHERE id = $1 AND organizer_id = $2', [eventId, organizerId])).rows[0] ?? null
}

const staffSelect = `SELECT a.id, a.user_profile_id AS "userProfileId", up.display_name AS "displayName", om.role AS "memberRole", a.status, a.gate_id AS "gateId", eg.name AS "gateName", a.created_at AS "createdAt"
                       FROM ticketug.event_staff_assignment a
                       JOIN ticketug.user_profile up ON up.id = a.user_profile_id
                       LEFT JOIN ticketug.organizer_member om ON om.organizer_id = $2 AND om.user_profile_id = a.user_profile_id
                       LEFT JOIN ticketug.event_gate eg ON eg.id = a.gate_id
                      WHERE a.event_id = $1 AND a.status = 'ACTIVE'
                      ORDER BY a.created_at`

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await loadEvent(organizerId, eventId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const result = await pool.query(staffSelect, [eventId, organizerId])
    return NextResponse.json({ staff: result.rows })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to load event staff' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await loadEvent(organizerId, eventId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const parsed = staffAssignmentSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid staff assignment' }, { status: 400 })
    // Only active members of this organizer can be assigned as event staff.
    const member = (await pool.query(`SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE'`, [organizerId, parsed.data.userProfileId])).rowCount
    if (member !== 1) return NextResponse.json({ error: 'User is not an active member of this organizer' }, { status: 400 })
    // Optional gate scope (Pair 1B): when provided, the gate must belong to this
    // event and be active; omitting it keeps the legacy event-wide assignment.
    const gateId = parsed.data.gateId ?? null
    if (gateId) {
      const gate = await pool.query(`SELECT 1 FROM ticketug.event_gate WHERE id = $1 AND event_id = $2 AND is_active = true`, [gateId, eventId])
      if (gate.rowCount !== 1) return NextResponse.json({ error: 'Gate not found for this event (it may be disabled)' }, { status: 400 })
    }
    const result = await pool.query(
      `INSERT INTO ticketug.event_staff_assignment (id, event_id, user_profile_id, gate_id, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (event_id, user_profile_id) DO UPDATE SET status = 'ACTIVE', gate_id = EXCLUDED.gate_id
       RETURNING id, event_id, user_profile_id, gate_id, status, created_at`,
      [randomUUID(), eventId, parsed.data.userProfileId, gateId],
    )
    return NextResponse.json({ assignment: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to assign event staff' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!(await loadEvent(organizerId, eventId))) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    const parsed = staffAssignmentSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid staff assignment' }, { status: 400 })
    const result = await pool.query(
      `UPDATE ticketug.event_staff_assignment SET status = 'INACTIVE'
        WHERE event_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE'
        RETURNING id, user_profile_id, status`,
      [eventId, parsed.data.userProfileId],
    )
    if (result.rowCount !== 1) return NextResponse.json({ error: 'Staff assignment not found' }, { status: 404 })
    return NextResponse.json({ assignment: result.rows[0] })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to remove event staff' }, { status: 500 })
  }
}
