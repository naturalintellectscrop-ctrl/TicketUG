import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'

export default async function OrganizerEventsPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  let rows: Array<{ id: string; title: string; slug: string; lifecycle_state: string; starts_at: string; timezone: string }> = []
  try {
    const result = await pool.query<{ id: string; title: string; slug: string; lifecycle_state: string; starts_at: string; timezone: string }>('SELECT id, title, slug, lifecycle_state, starts_at, timezone FROM ticketug.event WHERE organizer_id = $1 AND EXISTS (SELECT 1 FROM ticketug.organizer_member WHERE organizer_id=$1 AND user_profile_id=$2 AND status=\'ACTIVE\') ORDER BY starts_at DESC', [organizerId, context.profileId])
    rows = result.rows
  } catch {
    rows = []
  }
  return <main className="page-shell"><div className="section-heading"><div><p className="eyebrow">Events</p><h1>Manage your programme</h1><p className="lede">Create events, set up ticket types, and track sales as they go live.</p></div><Link className="button" href={`/organizer/${organizerId}/events/new`}>Create event</Link></div><div className="stack">{rows.length ? rows.map((event) => <article className="surface" key={event.id}><div className="row-between"><div><p className="eyebrow">{event.lifecycle_state}</p><h2>{event.title}</h2><p>{new Date(event.starts_at).toLocaleString('en-UG', { timeZone: event.timezone })}</p></div><Link href={`/organizer/${organizerId}/events/${event.id}`}>Open event</Link></div></article>) : <article className="surface"><h2>No events yet</h2><p>Create your first event to begin building its public presence.</p></article>}</div></main>
}
