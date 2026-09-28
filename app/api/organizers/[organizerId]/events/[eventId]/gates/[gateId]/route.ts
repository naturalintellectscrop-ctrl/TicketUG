import { NextRequest } from 'next/server'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { gateUpdateSchema } from '@/lib/gates'

type RouteContext = { params: Promise<{ organizerId: string; eventId: string; gateId: string }> }

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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { organizerId, eventId, gateId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  const limit = checkRateLimit(rateLimitKey(request, 'gates-update'), 20)
  if (!limit.allowed) return Response.json({ message: 'Too many requests. Try again shortly.' }, { status: 429 })
  const parsed = gateUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ message: parsed.error?.issues[0]?.message ?? 'Invalid gate update' }, { status: 400 })
  if (!(await loadEventForManager(organizerId, eventId, context.profileId))) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  const sets: string[] = []
  const values: unknown[] = []
  if (parsed.data.name !== undefined) { values.push(parsed.data.name); sets.push(`name = $${values.length}`) }
  if (parsed.data.description !== undefined) { values.push(parsed.data.description); sets.push(`description = $${values.length}`) }
  if (parsed.data.isActive !== undefined) { values.push(parsed.data.isActive); sets.push(`is_active = $${values.length}`) }
  if (!sets.length) return Response.json({ message: 'Nothing to update' }, { status: 400 })
  try {
    // Disabling a gate immediately fails its scanners closed (see gate.rules.ts);
    // deleting it also removes its ticket-type permissions and gate-scoped staff
    // assignments (ON DELETE CASCADE) rather than widening anyone to event-wide.
    const result = await pool.query(
      `UPDATE ticketug.event_gate SET ${sets.join(', ')}, updated_at = now()
        WHERE event_id = $${values.length + 1} AND id = $${values.length + 2}
        RETURNING id, name, description, is_active AS "isActive"`,
      [...values, eventId, gateId],
    )
    if (!result.rows[0]) return Response.json({ message: 'Gate not found' }, { status: 404 })
    return Response.json({ gate: result.rows[0] })
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ message: 'A gate with this name already exists on this event.' }, { status: 409 })
    return Response.json({ message: 'Unable to update gate' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { organizerId, eventId, gateId } = await params
  const context = await getTicketUGContext()
  if (!context) return Response.json({ message: 'Authentication required' }, { status: 401 })
  const limit = checkRateLimit(rateLimitKey(request, 'gates-delete'), 20)
  if (!limit.allowed) return Response.json({ message: 'Too many requests. Try again shortly.' }, { status: 429 })
  if (!(await loadEventForManager(organizerId, eventId, context.profileId))) return Response.json({ message: 'Organizer access denied' }, { status: 403 })
  const result = await pool.query('DELETE FROM ticketug.event_gate WHERE id = $1 AND event_id = $2 RETURNING id', [gateId, eventId])
  if (!result.rows[0]) return Response.json({ message: 'Gate not found' }, { status: 404 })
  return Response.json({ deleted: true })
}
