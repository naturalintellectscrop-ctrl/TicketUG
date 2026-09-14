import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export default async function OrganizerTicketsPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const eventResult = await pool.query<{ title: string }>('SELECT title FROM ticketug.event WHERE id=$1 AND organizer_id=$2 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$2 AND user_profile_id=$3 AND status=\'ACTIVE\')', [eventId, organizerId, context.profileId])
  if (!eventResult.rows[0]) notFound()
  const ticketResult = await pool.query<{ public_id: string; name: string; price_minor_units: string; currency: string; capacity: number; active: boolean; sale_starts_at: string | null; sale_ends_at: string | null }>('SELECT public_id,name,price_minor_units,currency,capacity,active,sale_starts_at,sale_ends_at FROM ticketug.ticket_type WHERE event_id=$1 ORDER BY sort_order,created_at', [eventId])
  return <main className="page-shell"><Link href={`/organizer/${organizerId}/events/${eventId}`}>Back to event</Link><div className="section-heading"><div><p className="eyebrow">Ticket types</p><h1>{eventResult.rows[0].title}</h1></div><Link className="button" href={`/organizer/${organizerId}/events/${eventId}/tickets/new`}>Add ticket type</Link></div><section className="stack">{ticketResult.rows.length ? ticketResult.rows.map((ticket) => <article className="surface" key={ticket.public_id}><div className="row-between"><div><h2>{ticket.name}</h2><p>{ticket.active ? 'Active' : 'Inactive'} · capacity {ticket.capacity}</p></div><strong>{Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}</strong></div></article>) : <div className="surface"><p>No ticket types yet.</p></div>}</section></main>
}
