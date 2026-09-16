import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export default async function OrganizerEventDetailPage({ params }: { params: Promise<{ organizerId: string; eventId: string }> }) {
  const { organizerId, eventId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const result = await pool.query<{ id: string; title: string; description: string; slug: string; lifecycle_state: string; publication_state: string; starts_at: string; ends_at: string; timezone: string }>(
    `SELECT id, title, description, slug, lifecycle_state, publication_state, starts_at, ends_at, timezone
       FROM ticketug.event
      WHERE id = $1 AND organizer_id = $2
        AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id = $2 AND user_profile_id = $3 AND status = 'ACTIVE')`,
    [eventId, organizerId, context.profileId],
  )
  const event = result.rows[0]
  if (!event) notFound()
  return <main className="page-shell"><Link href={`/organizer/${organizerId}/events`}>Back to events</Link><div className="surface" style={{ marginTop: 24 }}><p className="eyebrow">{event.lifecycle_state} · {event.publication_state}</p><h1>{event.title}</h1><p className="lede">{event.description || 'No description added yet.'}</p><div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{new Date(event.ends_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{event.timezone}</span></div><p>Slug: {event.slug}</p><div className="row"><div className="row"><Link className="button" href={`/organizer/${organizerId}/events/${eventId}/tickets`}>Manage ticket types</Link><Link className="button" href={`/organizer/${organizerId}/events/${eventId}/orders`}>View orders</Link></div><Link className="button" href={`/organizer/${organizerId}/events/${eventId}/orders`}>View orders</Link></div></div></main>
}
