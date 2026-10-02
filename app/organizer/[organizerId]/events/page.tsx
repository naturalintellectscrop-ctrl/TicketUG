import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { logServerError } from '@/lib/server/errors'
import { labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'

const LIST_LIMIT = 100

type EventRow = { id: string; title: string; slug: string; lifecycle_state: string; starts_at: string; timezone: string }

export default async function OrganizerEventsPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')

  // The list and its total share one try block: a database failure must render
  // "unavailable", never a misleading "No events yet" empty state.
  let rows: EventRow[] = []
  let total = 0
  let unavailable = false
  try {
    const [list, count] = await Promise.all([
      pool.query<EventRow>(
        `SELECT id, title, slug, lifecycle_state, starts_at, timezone
           FROM ticketug.event
          WHERE organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$1 AND user_profile_id=$2 AND status='ACTIVE')
          ORDER BY starts_at DESC
          LIMIT ${LIST_LIMIT}`,
        [organizerId, context.profileId],
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total
           FROM ticketug.event
          WHERE organizer_id = $1
            AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$1 AND user_profile_id=$2 AND status='ACTIVE')`,
        [organizerId, context.profileId],
      ),
    ])
    rows = list.rows
    total = count.rows[0].total
  } catch (error) {
    logServerError('page:organizer-events', error)
    unavailable = true
  }

  return (
    <>
      <PageHeader
        crumb="Events"
        title="Manage your programme"
        lede="Create events, set up ticket types, and track sales as they go live."
        actions={<Link className="button button-dark" href={`/organizer/${organizerId}/events/new`}>Create event</Link>}
      />

      {unavailable ? (
        <UnavailablePanel what="Your event list" />
      ) : rows.length === 0 ? (
        <section className="surface stack">
          <h2>No events yet</h2>
          <p className="muted">Create your first event to begin building its public presence.</p>
          <div className="row">
            <Link className="button button-dark" href={`/organizer/${organizerId}/events/new`}>Create event</Link>
          </div>
        </section>
      ) : (
        <>
          {total > LIST_LIMIT && (
            <p className="filter-count">{total.toLocaleString('en-UG')} events · showing latest {LIST_LIMIT}</p>
          )}
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Event</th><th scope="col">Lifecycle</th><th scope="col">Starts</th></tr></thead>
              <tbody>
                {rows.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link href={`/organizer/${organizerId}/events/${event.id}`}>{event.title}</Link>
                      <span className="table-cell-sub">{event.slug}</span>
                    </td>
                    <td><StatusPill tone={stateTone(event.lifecycle_state)}>{labelOf(LIFECYCLE_LABELS, event.lifecycle_state)}</StatusPill></td>
                    <td>{new Date(event.starts_at).toLocaleString('en-UG', { timeZone: event.timezone })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
