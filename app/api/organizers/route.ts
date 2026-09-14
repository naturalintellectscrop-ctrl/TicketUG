import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requireTicketUGContext } from '@/lib/request-context'
import { pool, withTransaction } from '@/lib/db'

const organizerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80),
})

export async function POST(request: Request) {
  try {
    const context = await requireTicketUGContext()
    const parsed = organizerSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid organizer details' }, { status: 400 })

    const organizer = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM ticketug.organizer_member WHERE user_profile_id = $1 AND role = 'ORGANIZER_OWNER' AND status = 'ACTIVE' LIMIT 1`,
        [context.profileId],
      )
      if (existing.rows[0]) throw new Error('ORGANIZER_ALREADY_EXISTS')

      const organizerId = randomUUID()
      await client.query(
        `INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES ($1, $2, $3, $4)`,
        [organizerId, parsed.data.name, parsed.data.slug, context.profileId],
      )
      await client.query(
        `INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status, invited_by)
         VALUES ($1, $2, $3, 'ORGANIZER_OWNER', 'ACTIVE', $3)`,
        [randomUUID(), organizerId, context.profileId],
      )
      await client.query(
        `INSERT INTO ticketug.security_event (id, user_profile_id, event_type) VALUES ($1, $2, 'MEMBERSHIP_CHANGED')`,
        [randomUUID(), context.profileId],
      )
      return { id: organizerId, ...parsed.data }
    })

    return NextResponse.json({ organizer }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error instanceof Error && error.message === 'ORGANIZER_ALREADY_EXISTS') return NextResponse.json({ error: 'Organizer already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Unable to create organizer' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const context = await requireTicketUGContext()
    const result = await pool.query(
      `SELECT o.id, o.name, o.slug, om.role, om.status
         FROM ticketug.organizer o
         JOIN ticketug.organizer_member om ON om.organizer_id = o.id
        WHERE om.user_profile_id = $1 AND om.status = 'ACTIVE'
        ORDER BY o.name`,
      [context.profileId],
    )
    return NextResponse.json({ organizers: result.rows })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Unable to load organizers' }, { status: 500 })
  }
}
