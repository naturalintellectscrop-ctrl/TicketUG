import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

type PublicEventRow = { public_id: string; slug: string; title: string; description: string; timezone: string; starts_at: string; ends_at: string; lifecycle_state: string; venue_name: string | null; venue_city: string | null; media: Array<{ url: string; altText: string; mediaType: string }> }
type TicketRow = { public_id: string; name: string; description: string; price_minor_units: string; currency: string; remaining_capacity: number; sale_starts_at: string | null; sale_ends_at: string | null; active: boolean }

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let found: PublicEventRow | undefined
  let tickets: TicketRow[] = []
  try {
    const result = await pool.query<PublicEventRow>('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, e.lifecycle_state, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,v.name,v.city', [slug])
    found = result.rows[0]
    if (found) {
      const ticketResult = await pool.query<TicketRow>('SELECT t.public_id, t.name, t.description, t.price_minor_units, t.currency, t.remaining_capacity, t.sale_starts_at, t.sale_ends_at, t.active FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true AND t.active=true ORDER BY t.sort_order, t.created_at', [slug])
      tickets = ticketResult.rows
    }
  } catch {
    notFound()
  }
  if (!found) notFound()
  const event = found
  const salesOpen = event.lifecycle_state === 'SALES_OPEN'
  const anyAvailable = tickets.some((ticket) => ticket.remaining_capacity > 0)
  function availability(ticket: TicketRow) {
    if (event.lifecycle_state === 'CANCELLED') return 'Event cancelled'
    if (!salesOpen) return 'Sales closed'
    if (ticket.remaining_capacity <= 0) return 'Sold out'
    if (ticket.sale_starts_at && new Date() < new Date(ticket.sale_starts_at)) return `Sales open ${new Date(ticket.sale_starts_at).toLocaleString('en-UG')}`
    if (ticket.sale_ends_at && new Date() >= new Date(ticket.sale_ends_at)) return 'Sales closed'
    return 'Available'
  }
  return <main className="public-event"><SiteHeader nextPath={`/events/${slug}/order`} /><p className="eyebrow">TicketUG event</p><h1>{event.title}</h1><p className="eyebrow">Public event page</p><p className="lede">{event.description}</p><div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })}</span><span>{event.timezone}</span>{event.venue_name && <span>{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</span>}</div>{salesOpen && anyAvailable && <div className="row"><Link className="button button-primary" href={`/events/${slug}/order`}>Get tickets</Link></div>}{event.lifecycle_state === 'CANCELLED' && <div className="surface"><p role="alert"><strong>This event has been cancelled.</strong> Contact the organizer about any tickets you already hold.</p></div>}<section className="stack"><div className="section-heading"><div><p className="eyebrow">Ticket types</p><h2>Choose your experience</h2></div></div>{tickets.length ? tickets.map((ticket) => <article className="surface" key={ticket.public_id}><div className="row-between"><div><h3>{ticket.name}</h3><p className="lede">{ticket.description}</p></div><strong>{Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}</strong></div><p>{availability(ticket)}</p></article>) : <div className="surface"><p>Ticket types will be announced soon.</p></div>}</section></main>
}
