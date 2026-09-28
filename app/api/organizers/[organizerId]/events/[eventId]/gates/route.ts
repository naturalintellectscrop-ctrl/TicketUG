import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { gateCreateSchema } from '@/lib/gates'

type RouteContext = { params: Promise<{ organizerId: string; eventId: string }> }

// Owner/manager-only load: tenant isolation + authority in one query (same
// pattern as the ticket-types and staff routes — no second authorization system).
async function loadEventForManager(organizerId: string, eventId: string, profileId: string) {
  return (await pool.query(
    `SELECT id FROM ticketug.event WHERE id = $1 AND organizer_id = $2
       AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER','ORGANIZER_MANAGER'))`,
    [eventId, organizerId, profileId],
  )).rows[0] ?? null
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && (error as { code?: string }).code === '23505'
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  if (!(await loadEventForManager(organizerId, eventId, context.profileId))) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  const result = await pool.query(
    `SELECT g.id, g.name, g.description, g.is_active AS "isActive", g.created_at AS "createdAt",
            COALESCE(json_agg(ttg.ticket_type_id) FILTER (WHERE ttg.ticket_type_id IS NOT NULL), '[]') AS "ticketTypeIds"
       FROM ticketug.event_gate g
       LEFT JOIN ticketug.ticket_type_gate ttg ON ttg.gate_id = g.id
      WHERE g.event_id = $1
      GROUP BY g.id
      ORDER BY g.created_at, g.name`,
    [eventId],
  )
  return Response.json({ gates: result.rows })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  const limit = checkRateLimit(rateLimitKey(request, 'gates-create'), 20)
  if (!limit.allowed) return Response.json({ message: 'Too many requests. Try again shortly.' }, { status: 429 })
  const parsed = gateCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: parsed.error?.issues[0]?.message ?? 'Invalid gate' }, { status: 400 })
  if (!(await loadEventForManager(organizerId, eventId, context.profileId))) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  try {
    const result = await pool.query(
      'INSERT INTO ticketug.event_gate (id, event_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id, name, description, is_active AS "isActive"',
      [randomUUID(), eventId, parsed.data.name, parsed.data.description],
    )
    return Response.json({ gate: result.rows[0] }, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ message: 'A gate with this name already exists on this event.' }, { status: 409 })
    return Response.json({ message: 'Unable to create gate' }, { status: 500 })
  }
}
