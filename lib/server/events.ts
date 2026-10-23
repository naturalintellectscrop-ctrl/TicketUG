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

// Lifecycle states in which the schedule may still change. Past the sales
// window (SALES_CLOSED onward) buyers hold tickets for fixed dates — only
// copy (title/description) remains editable, and CANCELLED/ARCHIVED events
// are frozen entirely. Enforced here (fast 4xx) AND in the UPDATE's WHERE
// clause (defense-in-depth against concurrent transitions).
const SCHEDULE_EDITABLE_STATES = ['DRAFT', 'PUBLISHED', 'SUSPENDED', 'SALES_OPEN']
const EDITABLE_STATES = [...SCHEDULE_EDITABLE_STATES, 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED']

export type EventDetailsUpdate = {
  title: string
  description: string
  startsAt?: string
  endsAt?: string
  timezone?: string
}

export async function updateEventDetails(profileId: string, organizerId: string, eventId: string, payload: EventDetailsUpdate) {
  const event = (await pool.query<{ lifecycle_state: string; starts_at: string; ends_at: string; timezone: string }>(
    `SELECT lifecycle_state, starts_at, ends_at, timezone
       FROM ticketug.event
      WHERE id = $1 AND organizer_id = $2
        AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE')`,
    [eventId, organizerId, profileId],
  )).rows[0]
  if (!event) throw notFound('Event not found')
  if (!EDITABLE_STATES.includes(event.lifecycle_state)) {
    throw badRequest(`A ${event.lifecycle_state.toLowerCase()} event can no longer be edited.`)
  }

  const scheduleRequested = payload.startsAt !== undefined || payload.endsAt !== undefined || payload.timezone !== undefined
  if (scheduleRequested && !SCHEDULE_EDITABLE_STATES.includes(event.lifecycle_state)) {
    throw badRequest('The schedule is locked once sales have closed — only the title and description can change.')
  }

  const startsAt = payload.startsAt ?? event.starts_at
  const endsAt = payload.endsAt ?? event.ends_at
  if (new Date(endsAt) <= new Date(startsAt)) throw badRequest('Event end must be after start')

  const result = await pool.query(
    `UPDATE ticketug.event e
        SET title = $3, description = $4,
            starts_at = CASE WHEN $5::text IS NOT NULL THEN $5::timestamptz ELSE e.starts_at END,
            ends_at = CASE WHEN $6::text IS NOT NULL THEN $6::timestamptz ELSE e.ends_at END,
            timezone = COALESCE($7, e.timezone),
            updated_at = now()
      WHERE e.id = $1 AND e.organizer_id = $2
        AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $8 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))
        AND e.lifecycle_state IN ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'SALES_OPEN', 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED')
      RETURNING e.id, e.title, e.slug, e.description, e.starts_at, e.ends_at, e.timezone, e.lifecycle_state`,
    [eventId, organizerId, payload.title, payload.description, payload.startsAt ?? null, payload.endsAt ?? null, payload.timezone ?? null, profileId],
  )
  // Zero rows here means the membership/lifecycle WHERE lost a race (e.g. a
  // concurrent CANCELLED transition) — never a silent success.
  if (!result.rows[0]) throw forbidden('Event edit rejected — verify your role and the event state.')
  return result.rows[0]
}

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
