import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { canManageMemberRole, canManageOrganizer } from '@/lib/organizer-authorization'
import { requireTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

const memberSchema = z.object({
  userProfileId: z.string().uuid(),
  role: z.enum(['ORGANIZER_MANAGER', 'EVENT_STAFF']),
})

export async function GET(_: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    if (!canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const result = await pool.query(
      `SELECT om.id, om.user_profile_id, up.display_name, om.role, om.status, om.created_at, om.updated_at
         FROM ticketug.organizer_member om JOIN ticketug.user_profile up ON up.id = om.user_profile_id
        WHERE om.organizer_id = $1 ORDER BY om.created_at`,
      [organizerId],
    )
    return NextResponse.json({ members: result.rows })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to load members' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const actor = context.organizerMemberships.find((membership) => membership.organizerId === organizerId)
    if (!actor || !canManageOrganizer(context, organizerId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const parsed = memberSchema.safeParse(await request.json())
    if (!parsed.success || !canManageMemberRole(actor.role, parsed.data.role)) return NextResponse.json({ error: 'Invalid membership change' }, { status: 400 })
    const result = await pool.query(
      `INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status, invited_by)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       ON CONFLICT (organizer_id, user_profile_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE', updated_at = now()
       RETURNING id, organizer_id, user_profile_id, role, status`,
      [randomUUID(), organizerId, parsed.data.userProfileId, parsed.data.role, context.profileId],
    )
    return NextResponse.json({ member: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to change membership' }, { status: 500 })
  }
}
