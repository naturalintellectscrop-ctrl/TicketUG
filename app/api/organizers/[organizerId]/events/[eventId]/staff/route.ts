import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { requireTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

const staffSchema = z.object({
  userProfileId: z.string().uuid(),
})

type RouteContext = { params: Promise<{ organizerId: string; eventId: string }> }

async function loadEvent(organizerId: string, eventId: string) {
  return (await pool.query('SELECT id FROM ticketug.event WHERE id = $1 AND organizer_id = $2', [eventId, organizerId])).rows[0] ?? null
}

const staffSelect = `SELECT a.id, a.user_profile_id AS "userProfileId", up.display_name AS "displayName", om.role AS "memberRole", a.status, a.created_at AS "createdAt"
                       FROM ticketug.event_staff_assignment a
                       JOIN ticketug.user_profile up ON up.id = a.user_profile_id
                       LEFT JOIN ticketug.organizer_member om ON om.organizer_id = $2 AND om.user_profile_id = a.user_profile_id
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
    const parsed = staffSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid staff assignment' }, { status: 400 })
    // Only active members of this organizer can be assigned as event staff.
    const member = (await pool.query(`SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE'`, [organizerId, parsed.data.userProfileId])).rowCount
    if (member !== 1) return NextResponse.json({ error: 'User is not an active member of this organizer' }, { status: 400 })
    const result = await pool.query(
      `INSERT INTO ticketug.event_staff_assignment (id, event_id, user_profile_id, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (event_id, user_profile_id) DO UPDATE SET status = 'ACTIVE'
       RETURNING id, event_id, user_profile_id, status, created_at`,
      [randomUUID(), eventId, parsed.data.userProfileId],
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
    const parsed = staffSchema.safeParse(await request.json())
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
