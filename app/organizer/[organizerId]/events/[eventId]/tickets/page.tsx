import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { pool } from '@/lib/db'

// Attendee names and emails are owner/manager data — event staff must not
// browse the full attendee list (matches the NestJS OWNER/MANAGER rule).
export default async function OrganizerTicketsPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  if (!canManageOrganizer(context, organizerId)) redirect(`/organizer/${organizerId}/events/${eventId}`)
  const eventResult = await pool.query<{ title: string }>('SELECT title FROM ticketug.event WHERE id=$1 AND organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$2 AND user_profile_id=$3 AND status=\'ACTIVE\')', [eventId, organizerId, context.profileId])
  const event = eventResult.rows[0]
  if (!event) notFound()
  const tickets = (await pool.query<{ public_id: string; order_number: string; ticket_type_name_snapshot: string; attendee_name: string; attendee_email: string; status: string; issued_at: string }>('SELECT t.public_id,o.order_number,t.ticket_type_name_snapshot,t.attendee_name,t.attendee_email,t.status,t.issued_at FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.event_id=$1 ORDER BY t.issued_at DESC,t.public_id', [eventId])).rows
  return <main className="page-shell"><Link href={`/organizer/${organizerId}/events/${eventId}`}>Back to event</Link><div className="section-heading"><div><p className="eyebrow">Issued tickets</p><h1>{event.title}</h1></div><div className="row"><Link className="button button-quiet" href={`/organizer/${organizerId}/events/${eventId}/tickets/new`}>New ticket type</Link><span>{tickets.length} issued</span></div></div><section className="stack">{tickets.length ? tickets.map((ticket) => <article className="surface" key={ticket.public_id}><div className="row-between"><div><h2>{ticket.ticket_type_name_snapshot}</h2><p>{ticket.attendee_name} · {ticket.attendee_email}</p><p>Order {ticket.order_number} · issued {new Date(ticket.issued_at).toLocaleString('en-UG')}</p></div><div><strong>{ticket.status}</strong><p>{ticket.public_id}</p></div></div></article>) : <div className="surface"><p>No tickets have been issued for this event yet. Create a ticket type and open sales to start selling.</p></div>}</section></main>
}
