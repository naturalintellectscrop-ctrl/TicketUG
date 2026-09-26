import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { EventStaffManager } from '@/components/event-staff-manager'
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
  const canManage = canManageOrganizer(context, organizerId)
  const staff = (await pool.query(
    `SELECT a.id, a.user_profile_id AS "userProfileId", up.display_name AS "displayName", om.role AS "memberRole", a.status
       FROM ticketug.event_staff_assignment a
       JOIN ticketug.user_profile up ON up.id = a.user_profile_id
       LEFT JOIN ticketug.organizer_member om ON om.organizer_id = $2 AND om.user_profile_id = a.user_profile_id
      WHERE a.event_id = $1 AND a.status = 'ACTIVE'
      ORDER BY a.created_at`,
    [eventId, organizerId],
  )).rows
  const members = canManage
    ? (await pool.query(
        `SELECT om.user_profile_id AS "userProfileId", up.display_name AS "displayName", om.role
           FROM ticketug.organizer_member om JOIN ticketug.user_profile up ON up.id = om.user_profile_id
          WHERE om.organizer_id = $1 AND om.status = 'ACTIVE'
          ORDER BY up.display_name NULLS LAST`,
        [organizerId],
      )).rows
    : []
  return (
    <main className="page-shell">
      <Link href={`/organizer/${organizerId}/events`}>Back to events</Link>
      <div className="surface" style={{ marginTop: 24 }}>
        <p className="eyebrow">{event.lifecycle_state} · {event.publication_state}</p>
        <h1>{event.title}</h1>
        <p className="lede">{event.description || 'No description added yet.'}</p>
        <div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{new Date(event.ends_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{event.timezone}</span></div>
        <p>Slug: {event.slug}</p>
        <div className="row">
          <Link className="button" href={`/organizer/${organizerId}/events/${eventId}/tickets`}>Manage ticket types</Link>
          <Link className="button" href={`/organizer/${organizerId}/events/${eventId}/orders`}>View orders</Link>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <EventStaffManager organizerId={organizerId} eventId={eventId} initialStaff={staff} members={members} />
      </div>
    </main>
  )
}
