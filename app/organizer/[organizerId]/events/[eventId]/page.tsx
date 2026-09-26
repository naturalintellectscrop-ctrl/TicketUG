import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { EventLifecycleControls } from '@/components/event-lifecycle-controls'
import { EventStaffManager } from '@/components/event-staff-manager'
import { loadEventSalesMetrics } from '@/lib/event-sales-metrics'
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
  const isOwner = context.organizerMemberships.find((membership) => membership.organizerId === organizerId && membership.status === 'ACTIVE')?.role === 'ORGANIZER_OWNER'
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
  // Sales aggregates are owner/manager data (same gate as the sales API and the
  // orders/issued-tickets pages); fetched server-side, aggregate numbers only.
  const sales = canManage ? await loadEventSalesMetrics(eventId) : null
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
          <Link className="button" href={`/organizer/${organizerId}/events/${eventId}/tickets`}>Issued tickets</Link>
          <Link className="button" href={`/organizer/${organizerId}/events/${eventId}/orders`}>View orders</Link>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <EventLifecycleControls organizerId={organizerId} eventId={eventId} currentState={event.lifecycle_state} canManage={canManage} isOwner={isOwner} />
      </div>
      {sales && (
        <div style={{ marginTop: 24 }}>
          <section className="surface stack" aria-label="Event sales summary">
            <div className="row-between">
              <div>
                <p className="eyebrow">Sales</p>
                <h2>Sales summary</h2>
              </div>
              <span className="muted">{sales.paidOrderCount} paid {sales.paidOrderCount === 1 ? 'order' : 'orders'}</span>
            </div>
            <section className="metric-grid" aria-label="Sales totals">
              <article className="surface metric-card">
                <p className="eyebrow">Paid revenue (UGX)</p>
                <strong>{sales.paidRevenueMinor.toLocaleString('en-UG')}</strong>
                <p className="muted">Collected from paid orders</p>
              </article>
              <article className="surface metric-card">
                <p className="eyebrow">Tickets issued</p>
                <strong>{sales.ticketsIssued.toLocaleString('en-UG')}</strong>
                <p className="muted">Across all orders</p>
              </article>
              <article className="surface metric-card">
                <p className="eyebrow">Checked in</p>
                <strong>{sales.checkedIn.toLocaleString('en-UG')}</strong>
                <p className="muted">Scanned at the door</p>
              </article>
              <article className="surface metric-card">
                <p className="eyebrow">Remaining capacity</p>
                <strong>{sales.remainingCapacity.toLocaleString('en-UG')}</strong>
                <p className="muted">Of {sales.totalCapacity.toLocaleString('en-UG')} total</p>
              </article>
            </section>
            <div>
              <h3>Orders by status</h3>
              <div className="event-meta" style={{ margin: 0 }}>
                {sales.ordersByStatus.map((entry) => <span key={entry.status}>{entry.status} · {entry.count}</span>)}
              </div>
            </div>
            <div>
              <h3>Capacity by ticket type</h3>
              {sales.ticketTypes.length ? (
                <dl className="stack" style={{ margin: 0 }}>
                  {sales.ticketTypes.map((type) => (
                    <div className="row-between" key={type.id}>
                      <dt>{type.name}{!type.active && <span className="muted"> · inactive</span>}</dt>
                      <dd className="muted" style={{ margin: 0 }}>{type.remainingCapacity.toLocaleString('en-UG')} of {type.capacity.toLocaleString('en-UG')} remaining</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="muted">No ticket types created yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <EventStaffManager organizerId={organizerId} eventId={eventId} initialStaff={staff} members={members} />
      </div>
    </main>
  )
}
