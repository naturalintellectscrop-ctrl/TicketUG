import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { EventLifecycleControls } from '@/components/event-lifecycle-controls'
import { EventStaffManager } from '@/components/event-staff-manager'
import { GateManager } from '@/components/gate-manager'
import { loadEventSalesMetrics } from '@/lib/event-sales-metrics'
import { pool } from '@/lib/db'
import { labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'

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
    `SELECT a.id, a.user_profile_id AS "userProfileId", up.display_name AS "displayName", om.role AS "memberRole", a.status, a.gate_id AS "gateId", eg.name AS "gateName"
       FROM ticketug.event_staff_assignment a
       JOIN ticketug.user_profile up ON up.id = a.user_profile_id
       LEFT JOIN ticketug.organizer_member om ON om.organizer_id = $2 AND om.user_profile_id = a.user_profile_id
       LEFT JOIN ticketug.event_gate eg ON eg.id = a.gate_id
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
  // Gate management + gate-scoped staff assignment (Pair 1B) — owner/manager only.
  const gates = canManage
    ? (await pool.query(
        `SELECT g.id, g.name, g.description, g.is_active AS "isActive", g.created_at AS "createdAt", COALESCE(json_agg(ttg.ticket_type_id) FILTER (WHERE ttg.ticket_type_id IS NOT NULL), '[]') AS "ticketTypeIds"
           FROM ticketug.event_gate g LEFT JOIN ticketug.ticket_type_gate ttg ON ttg.gate_id = g.id
          WHERE g.event_id = $1 GROUP BY g.id ORDER BY g.created_at, g.name`,
        [eventId],
      )).rows
    : []
  const ticketTypes = canManage
    ? (await pool.query('SELECT id, public_id AS "publicId", name, active FROM ticketug.ticket_type WHERE event_id = $1 ORDER BY sort_order, created_at', [eventId])).rows
    : []
  return (
    <>
      <PageHeader
        crumb="Events"
        title={event.title}
        lede={event.description || 'No description added yet.'}
        actions={
          <>
            <StatusPill tone={stateTone(event.lifecycle_state)}>{labelOf(LIFECYCLE_LABELS, event.lifecycle_state)}</StatusPill>
            <StatusPill tone={event.publication_state === 'PUBLIC' ? 'ok' : 'info'}>{event.publication_state === 'PUBLIC' ? 'Public' : 'Private'}</StatusPill>
            <Link className="button button-quiet" href={`/organizer/${organizerId}/events/${eventId}/tickets`}>Issued tickets</Link>
            <Link className="button button-dark" href={`/organizer/${organizerId}/events/${eventId}/orders`}>View orders</Link>
          </>
        }
      />
      <section className="surface stack" aria-label="Event schedule">
        <div className="event-meta"><span>{new Date(event.starts_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{new Date(event.ends_at).toLocaleString('en-UG', { timeZone: event.timezone })}</span><span>{event.timezone}</span></div>
        <p>Slug: {event.slug}</p>
      </section>
      <section className="console-section">
        <EventLifecycleControls organizerId={organizerId} eventId={eventId} currentState={event.lifecycle_state} canManage={canManage} isOwner={isOwner} />
      </section>
      {sales && (
        <section className="console-section" aria-label="Event sales summary">
          <SectionHead title="Sales summary" note={`${sales.paidOrderCount} paid ${sales.paidOrderCount === 1 ? 'order' : 'orders'}`} />
          <section className="surface stack">
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
        </section>
      )}
      {canManage && (
        <section className="console-section">
          <GateManager organizerId={organizerId} eventId={eventId} initialGates={gates} ticketTypes={ticketTypes} />
        </section>
      )}
      <section className="console-section">
        <EventStaffManager organizerId={organizerId} eventId={eventId} initialStaff={staff} members={members} gates={gates.map((gate) => ({ id: gate.id, name: gate.name, isActive: gate.isActive }))} />
      </section>
    </>
  )
}
