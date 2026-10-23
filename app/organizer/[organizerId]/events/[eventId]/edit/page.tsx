import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { utcToWallTime } from '@/lib/timezone'
import { labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'
import { EventDetailsForm } from '@/components/event-details-form'

export const dynamic = 'force-dynamic'

// Mirrors lib/server/events.ts — duplicated as UI *presentation* only; the
// endpoint remains the sole authority and re-checks everything.
const SCHEDULE_EDITABLE_STATES = ['DRAFT', 'PUBLISHED', 'SUSPENDED', 'SALES_OPEN']
const EDITABLE_STATES = [...SCHEDULE_EDITABLE_STATES, 'SALES_CLOSED', 'EVENT_LIVE', 'COMPLETED']

/**
 * Edit event details (spec §5.2.2). Scope: ACTIVE membership on this event's
 * workspace; owners and managers only (the UPDATE endpoint enforces the same
 * independently — staff reaching this URL are redirected).
 */
export default async function OrganizerEventEditPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')

  const event = (await pool.query<{ id: string; title: string; description: string; starts_at: string; ends_at: string; timezone: string; lifecycle_state: string }>(
    `SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.timezone, e.lifecycle_state
       FROM ticketug.event e
      WHERE e.id = $1 AND e.organizer_id = $2
        AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE' AND role IN ('ORGANIZER_OWNER', 'ORGANIZER_MANAGER'))`,
    [eventId, organizerId, context.profileId],
  )).rows[0]
  if (!event) notFound()

  const scheduleLocked = !SCHEDULE_EDITABLE_STATES.includes(event.lifecycle_state)
  const editable = EDITABLE_STATES.includes(event.lifecycle_state)

  return (
    <>
      <PageHeader
        crumb="Events"
        title="Edit event details"
        lede={editable ? 'Changes apply to the public event page immediately after saving.' : 'This event can no longer be edited.'}
        actions={<StatusPill tone={stateTone(event.lifecycle_state)}>{labelOf(LIFECYCLE_LABELS, event.lifecycle_state)}</StatusPill>}
      />

      {editable ? (
        <EventDetailsForm
          organizerId={organizerId}
          eventId={eventId}
          defaults={{
            title: event.title,
            description: event.description,
            startsAt: utcToWallTime(event.starts_at, event.timezone),
            endsAt: utcToWallTime(event.ends_at, event.timezone),
            timezone: event.timezone,
          }}
          scheduleLocked={scheduleLocked}
        />
      ) : (
        <section className="surface stack">
          <h2>This event is frozen</h2>
          <p className="muted">A {labelOf(LIFECYCLE_LABELS, event.lifecycle_state).toLowerCase()} event can no longer be edited — its record is kept as history.</p>
          <div className="row"><Link className="button button-quiet" href={`/organizer/${organizerId}/events/${eventId}`}>Back to the event</Link></div>
        </section>
      )}
    </>
  )
}
