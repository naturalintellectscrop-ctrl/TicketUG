import { notFound } from 'next/navigation'
import { pool } from '@/lib/db'

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let event
  let tickets: Array<{ public_id: string; name: string; description: string; price_minor_units: string; currency: string; capacity: number; sale_starts_at: string | null; sale_ends_at: string | null; active: boolean }> = []
  try {
    const result = await pool.query('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,v.name,v.city', [slug])
    event = result.rows[0]
    if (event) {
      const ticketResult = await pool.query('SELECT t.public_id, t.name, t.description, t.price_minor_units, t.currency, t.capacity, t.sale_starts_at, t.sale_ends_at, t.active FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true AND t.active=true ORDER BY t.sort_order, t.created_at', [slug])
      tickets = ticketResult.rows
    }
  } catch {
    notFound()
  }
  if (!event) notFound()
  return <main className="public-event"><p className="eyebrow">TicketUG event</p><h1>{event.title}</h1><p className="eyebrow">Public event page</p><p className="lede">{event.description}</p><div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { dateStyle: 'full', timeStyle: 'short', timeZone: event.timezone })}</span><span>{event.timezone}</span>{event.venue_name && <span>{event.venue_name}{event.venue_city ? `, ${event.venue_city}` : ''}</span>}</div><section className="stack"><div className="section-heading"><div><p className="eyebrow">Ticket types</p><h2>Choose your experience</h2></div></div>{tickets.length ? tickets.map((ticket) => <article className="surface" key={ticket.public_id}><div className="row-between"><div><h3>{ticket.name}</h3><p className="lede">{ticket.description}</p></div><strong>{Number(ticket.price_minor_units).toLocaleString('en-UG')} {ticket.currency}</strong></div><p>{ticket.capacity === 0 ? 'Sold out' : ticket.sale_starts_at && new Date() < new Date(ticket.sale_starts_at) ? `Sales open ${new Date(ticket.sale_starts_at).toLocaleString('en-UG')}` : ticket.sale_ends_at && new Date() >= new Date(ticket.sale_ends_at) ? 'Sales closed' : 'Available'}</p></article>) : <div className="surface"><p>Ticket types will be announced soon.</p></div>}</section></main>
}
