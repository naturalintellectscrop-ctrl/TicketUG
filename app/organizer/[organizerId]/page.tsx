import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { Metric, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { getTicketUGContext } from '@/lib/request-context'
import { canManageOrganizer } from '@/lib/organizer-authorization'
import { loadWorkspaceOverview } from '@/lib/organizer-reports'
import { formatDateTime, labelOf, LIFECYCLE_LABELS, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/**
 * Workspace Overview (spec §5.1) — the screen /organizer/<id> was missing
 * entirely (it 404'd). Every figure is a real, membership-scoped SQL
 * aggregate; "gross" is explicitly labeled provider-collected pre-fee
 * (the schema has no fee primitives, so no "net revenue" is claimed).
 * Revenue/order figures render only for owners and managers.
 */
export default async function OrganizerOverviewPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const canManage = canManageOrganizer(context, organizerId)
  const overview = await loadWorkspaceOverview(organizerId, context.profileId)

  const paid = overview?.orderStates.find((entry) => entry.state === 'PAID')
  const lifecycleCount = (state: string) => overview?.lifecycleCounts.find((entry) => entry.lifecycle_state === state)?.event_count ?? 0

  return (
    <>
      <PageHeader
        crumb="Overview"
        title="Workspace overview"
        lede="Where this workspace stands right now — sales, inventory, and the events that need you."
        actions={canManage ? <Link className="button button-dark" href={`/organizer/${organizerId}/events/new`}>Create event</Link> : undefined}
      />

      {!overview ? (
        <UnavailablePanel what="Your workspace overview" />
      ) : (
        <>
          {canManage && (
            <section aria-label="Sales at a glance">
              <SectionHead title="Sales at a glance" note={`${paid?.count ?? 0} paid ${paid?.count === 1 ? 'order' : 'orders'} across all events`} />
              <div className="metric-grid">
                <Metric label="Gross paid value" value={`${Number(paid?.totalMinorUnits ?? 0).toLocaleString('en-UG')} UGX`} note="Provider-collected on paid orders, before platform fees" accent />
                <Metric label="Tickets issued" value={overview.tickets.issued.toLocaleString('en-UG')} note="Across every event" href={`/organizer/${organizerId}/reports`} />
                <Metric label="Checked in" value={overview.tickets.checkedIn.toLocaleString('en-UG')} note="Scanned at gates" />
                <Metric label="Remaining inventory" value={overview.capacity.remaining.toLocaleString('en-UG')} note={`Of ${overview.capacity.total.toLocaleString('en-UG')} total capacity`} />
              </div>
            </section>
          )}

          {canManage && (
            <section className="console-section" aria-label="Orders by payment state">
              <SectionHead title="Orders by payment state" note="Every order ever placed in this workspace" />
              <div className="event-meta" style={{ margin: 0 }}>
                {overview.orderStates.map((entry) => (
                  <Link key={entry.state} href={`/organizer/${organizerId}/orders?state=${entry.state}`} className="pill" data-tone={stateTone(entry.state)} style={{ textDecoration: 'none' }}>
                    {labelOf(ORDER_PAYMENT_STATE_LABELS, entry.state)} · {entry.count}
                  </Link>
                ))}
              </div>
              <p className="muted" style={{ margin: '10px 0 0' }}>Select a state to filter the <Link href={`/organizer/${organizerId}/orders`}>workspace order list</Link>.</p>
            </section>
          )}

          <section className="console-section" aria-label="Upcoming schedule">
            <SectionHead title="Upcoming schedule" note={`${lifecycleCount('SALES_OPEN')} with sales open · ${lifecycleCount('DRAFT')} still drafts`} />
            {overview.upcoming.length ? (
              <div className="platform-scroll">
                <table className="platform-table">
                  <thead><tr><th scope="col">Event</th><th scope="col">Lifecycle</th><th scope="col">Starts</th></tr></thead>
                  <tbody>
                    {overview.upcoming.map((event) => (
                      <tr key={event.id}>
                        <td><Link href={`/organizer/${organizerId}/events/${event.id}`}>{event.title}</Link></td>
                        <td><StatusPill tone={stateTone(event.lifecycle_state)}>{labelOf(LIFECYCLE_LABELS, event.lifecycle_state)}</StatusPill></td>
                        <td>{formatDateTime(event.starts_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted empty-state">No scheduled events ahead. {canManage ? 'Create one to get started.' : ''}</p>
            )}
          </section>

          {canManage && (
            <section className="console-section" aria-label="Events needing attention">
              <SectionHead title="Needs attention" note="Derived from real event state — never invented" />
              {overview.attention.unpublishedWithFutureStarts.length === 0 && overview.attention.withoutTicketTypes.length === 0 ? (
                <p className="muted empty-state">Nothing needs attention right now.</p>
              ) : (
                <div className="alert-list">
                  {overview.attention.unpublishedWithFutureStarts.map((event) => (
                    <div className="alert-item" data-severity="warn" key={`draft-${event.id}`}>
                      <span className="alert-dot" aria-hidden="true" />
                      <div>
                        <strong>Not on sale yet: <Link href={`/organizer/${organizerId}/events/${event.id}`}>{event.title}</Link></strong>
                        <p className="muted">Starts {formatDateTime(event.starts_at)} but is still {labelOf(LIFECYCLE_LABELS, event.lifecycle_state).toLowerCase()} — publish it (or open sales) so buyers can find it.</p>
                      </div>
                    </div>
                  ))}
                  {overview.attention.withoutTicketTypes.map((event) => (
                    <div className="alert-item" data-severity="warn" key={`types-${event.id}`}>
                      <span className="alert-dot" aria-hidden="true" />
                      <div>
                        <strong>No ticket types: <Link href={`/organizer/${organizerId}/events/${event.id}`}>{event.title}</Link></strong>
                        <p className="muted">Nobody can buy a ticket for this event until a ticket type exists. <Link href={`/organizer/${organizerId}/events/${event.id}/tickets/new`}>Add one</Link>.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!canManage && (
            <p className="muted" style={{ marginTop: 24 }}>Sales and order figures are available to workspace owners and managers. Ask your workspace owner for access.</p>
          )}
        </>
      )}
    </>
  )
}
