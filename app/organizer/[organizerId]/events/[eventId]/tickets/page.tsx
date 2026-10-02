import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { pool } from '@/lib/db'
import { logServerError } from '@/lib/server/errors'
import { labelOf, TICKET_STATUS_LABELS } from '@/lib/platform/format'

const LIST_LIMIT = 200

type TicketRow = { public_id: string; order_number: string; ticket_type_name_snapshot: string; attendee_name: string; attendee_email: string; status: string; issued_at: string }

// Attendee names and emails are owner/manager data — event staff must not
// browse the full attendee list (matches the NestJS OWNER/MANAGER rule).
export default async function OrganizerTicketsPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  if (!canManageOrganizer(context, organizerId)) redirect(`/organizer/${organizerId}/events/${eventId}`)

  let event: { title: string } | null = null
  let rows: TicketRow[] = []
  let total = 0
  let unavailable = false
  try {
    const eventResult = await pool.query<{ title: string }>(
      'SELECT title FROM ticketug.event WHERE id=$1 AND organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$2 AND user_profile_id=$3 AND status=\'ACTIVE\')',
      [eventId, organizerId, context.profileId],
    )
    event = eventResult.rows[0] ?? null
    if (event) {
      const [list, count] = await Promise.all([
        pool.query<TicketRow>('SELECT t.public_id,o.order_number,t.ticket_type_name_snapshot,t.attendee_name,t.attendee_email,t.status,t.issued_at FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.event_id=$1 ORDER BY t.issued_at DESC,t.public_id LIMIT 200', [eventId]),
        pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM ticketug.ticket t WHERE t.event_id=$1', [eventId]),
      ])
      rows = list.rows
      total = count.rows[0].total
    }
  } catch (error) {
    logServerError('page:organizer-event-tickets', error)
    unavailable = true
  }
  if (!event && !unavailable) notFound()

  return (
    <>
      <PageHeader
        crumb="Events"
        title={event?.title ?? 'Issued tickets'}
        actions={<Link className="button button-dark" href={`/organizer/${organizerId}/events/${eventId}/tickets/new`}>New ticket type</Link>}
      />

      {unavailable ? (
        <UnavailablePanel what="The ticket inventory" />
      ) : (
        <>
          <SectionHead title="Issued tickets" note={`${total.toLocaleString('en-UG')} issued`} />
          {total > LIST_LIMIT && (
            <p className="filter-count" style={{ marginBottom: 10 }}>showing latest {LIST_LIMIT}</p>
          )}
          {rows.length ? (
            <div className="platform-scroll">
              <table className="platform-table">
                <thead><tr><th scope="col">Ticket type</th><th scope="col">Attendee</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Issued</th></tr></thead>
                <tbody>
                  {rows.map((ticket) => (
                    <tr key={ticket.public_id}>
                      <td>{ticket.ticket_type_name_snapshot}<span className="table-cell-sub">{ticket.public_id}</span></td>
                      <td>{ticket.attendee_name || '—'}<span className="table-cell-sub">{ticket.attendee_email}</span></td>
                      <td>{ticket.order_number}</td>
                      <td><StatusPill tone={stateTone(ticket.status)}>{labelOf(TICKET_STATUS_LABELS, ticket.status)}</StatusPill></td>
                      <td>{new Date(ticket.issued_at).toLocaleString('en-UG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="surface">
              <p>No tickets have been issued for this event yet. Create a ticket type and open sales to start selling.</p>
            </section>
          )}
        </>
      )}
    </>
  )
}
