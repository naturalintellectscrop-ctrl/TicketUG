import { NextRequest } from 'next/server'
import { getTicketUGContext } from '@/lib/request-context'
import { pool, withTransaction } from '@/lib/db'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { diffGateTicketTypes, gateTicketTypesSchema } from '@/lib/gates'

type RouteContext = { params: Promise<{ organizerId: string; eventId: string; gateId: string }> }

async function loadEventForManager(organizerId: string, eventId: string, profileId: string) {
  return (await pool.query(
    `SELECT id FROM ticketug.event WHERE id = $1 AND organizer_id = $2
       AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER','ORGANIZER_MANAGER'))`,
    [eventId, organizerId, profileId],
  )).rows[0] ?? null
}

// Replace-set semantics: the submitted list becomes exactly the set of ticket
// types permitted through this gate. Only the delta is written, inside one
// transaction, so check-in always reads a consistent permission set.
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { organizerId, eventId, gateId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  const limit = checkRateLimit(rateLimitKey(request, 'gate-permissions'), 30)
  if (!limit.allowed) return Response.json({ message: 'Too many requests. Try again shortly.' }, { status: 429 })
  const parsed = gateTicketTypesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: parsed.error?.issues[0]?.message ?? 'Invalid gate permissions' }, { status: 400 })
  if (!(await loadEventForManager(organizerId, eventId, context.profileId))) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  const gate = (await pool.query('SELECT id FROM ticketug.event_gate WHERE id = $1 AND event_id = $2', [gateId, eventId])).rows[0]
  if (!gate) return Response.json({ message: 'Gate not found' }, { status: 404 })
  const ids = Array.from(new Set(parsed.data.ticketTypeIds))
  if (ids.length) {
    const owned = (await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM ticketug.ticket_type WHERE event_id = $1 AND id = ANY($2::uuid[])', [eventId, ids])).rows[0]?.count ?? 0
    if (owned !== ids.length) return Response.json({ message: 'One or more ticket types do not belong to this event' }, { status: 400 })
  }
  const current = (await pool.query<{ ticket_type_id: string }>('SELECT ticket_type_id FROM ticketug.ticket_type_gate WHERE gate_id = $1', [gateId])).rows.map((row) => row.ticket_type_id)
  const diff = diffGateTicketTypes(current, ids)
  await withTransaction(async (client) => {
    if (diff.toRemove.length) await client.query('DELETE FROM ticketug.ticket_type_gate WHERE gate_id = $1 AND ticket_type_id = ANY($2::uuid[])', [gateId, diff.toRemove])
    if (diff.toAdd.length) await client.query('INSERT INTO ticketug.ticket_type_gate (ticket_type_id, gate_id) SELECT x, $1 FROM unnest($2::uuid[]) AS x', [gateId, diff.toAdd])
  })
  return Response.json({ ticketTypeIds: ids })
}
