import { pool } from '@/lib/db'
import { canTransition, EVENT_STATES, type EventLifecycleState } from '@/lib/rules/event-lifecycle'
import { badRequest, forbidden, notFound } from '@/lib/server/errors'

// Event lifecycle transition — Supabase-native replacement for the removed
// NestJS transition endpoint. The state machine now has THREE enforcement
// layers (route validation here, guarded atomic UPDATE in
// ticketug.transition_event_lifecycle, and the DB CHECK constraints):
//   * route: membership + role + transition-map validation (fast 4xx answers);
//   * SQL function: re-verifies authority + transition inside the UPDATE
//     (defense-in-depth; owner-only for PUBLISHED/CANCELLED);
//   * WHERE lifecycle_state = current → concurrent transitions serialize.

const writeRoles = ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER']

export async function transitionEvent(profileId: string, eventId: string, to: string) {
  const event = (await pool.query<{ id: string; organizer_id: string; lifecycle_state: EventLifecycleState }>(
    'SELECT id, organizer_id, lifecycle_state FROM ticketug.event WHERE id = $1',
    [eventId],
  )).rows[0]
  if (!event) throw notFound('Event not found')

  const membership = (await pool.query<{ role: string }>(
    `SELECT role FROM ticketug.organizer_member
      WHERE organizer_id = $1 AND user_profile_id = $2 AND status = 'ACTIVE'`,
    [event.organizer_id, profileId],
  )).rows[0]
  const role = membership?.role
  if (!role || !writeRoles.includes(role)) throw forbidden('Organizer access denied')
  if ((to === 'PUBLISHED' || to === 'CANCELLED') && role !== 'ORGANIZER_OWNER') throw forbidden('Organizer access denied')

  const target = EVENT_STATES.find((state) => state === to)
  if (!target) throw badRequest('Unknown lifecycle state')
  if (!canTransition(event.lifecycle_state, target)) throw badRequest('Invalid event lifecycle transition')

  // The SQL function re-asserts everything and performs the guarded update.
  const result = await pool.query<{ result: Record<string, unknown> }>(
    'SELECT ticketug.transition_event_lifecycle($1::uuid, $2::uuid, $3::text) AS result',
    [profileId, eventId, target],
  )
  return result.rows[0].result
}
