import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { pool } from '@/lib/db'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { requireTicketUGContext } from '@/lib/request-context'

const assignmentSchema = z.object({ userProfileId: z.string().uuid() })

async function authorizeEvent(organizerId: string, eventId: string, profileId: string) {
  const result = await pool.query(
    `SELECT e.id
       FROM ticketug.event e
      WHERE e.id = $1 AND e.organizer_id = $2
        AND EXISTS (
          SELECT 1 FROM ticketug.organizer_member om
           WHERE om.organizer_id = $2 AND om.user_profile_id = $3
             AND om.status = 'ACTIVE'
        )`,
    [eventId, organizerId, profileId],
  )
  return Boolean(result.rows[0])
}

export async function GET(_: Request, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId) || !(await authorizeEvent(organizerId, eventId, context.profileId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await pool.query(
      `SELECT esa.id, esa.user_profile_id, up.display_name, om.role, esa.status, esa.created_at
         FROM ticketug.event_staff_assignment esa
         JOIN ticketug.user_profile up ON up.id = esa.user_profile_id
         JOIN ticketug.organizer_member om ON om.organizer_id = $1 AND om.user_profile_id = esa.user_profile_id
        WHERE esa.event_id = $2 AND esa.status = 'ACTIVE'
        ORDER BY esa.created_at`,
      [organizerId, eventId],
    )
    return NextResponse.json({ assignments: result.rows })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to load event staff' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId) || !(await authorizeEvent(organizerId, eventId, context.profileId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const parsed = assignmentSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid staff member' }, { status: 400 })
    const result = await pool.query(
      `INSERT INTO ticketug.event_staff_assignment (id, event_id, user_profile_id, status)
       SELECT $1, $2, om.user_profile_id, 'ACTIVE'
         FROM ticketug.organizer_member om
        WHERE om.organizer_id = $3 AND om.user_profile_id = $4
          AND om.status = 'ACTIVE' AND om.role = 'EVENT_STAFF'
       ON CONFLICT (event_id, user_profile_id) DO UPDATE SET status = 'ACTIVE'
       RETURNING id, event_id, user_profile_id, status`,
      [randomUUID(), eventId, organizerId, parsed.data.userProfileId],
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Only active event staff can be assigned' }, { status: 400 })
    return NextResponse.json({ assignment: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to assign event staff' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId, eventId } = await params
    if (!canManageOrganizer(context, organizerId) || !(await authorizeEvent(organizerId, eventId, context.profileId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const parsed = assignmentSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid staff member' }, { status: 400 })
    await pool.query(
      `UPDATE ticketug.event_staff_assignment
          SET status = 'INACTIVE'
        WHERE event_id = $1 AND user_profile_id = $2`,
      [eventId, parsed.data.userProfileId],
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to remove event staff' }, { status: 500 })
  }
}
