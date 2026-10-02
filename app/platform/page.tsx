import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { AlertList, Metric, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { derivePlatformAlerts } from '@/lib/platform/alerts'
import { loadPlatformMetrics, loadRecentActivity } from '@/lib/platform/queries'
import { formatDateTime, formatMoney, labelOf, ORDER_PAYMENT_STATE_LABELS, LIFECYCLE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/**
 * Platform overview — the screen the platform owner lands on right after
 * signing in. The console opens straight into operations: the marketing
 * welcome hero lives only on the customer signed-in screen (/account),
 * never on this admin surface. Every number is read live from the database;
 * when the database cannot be reached the page says so instead of rendering
 * zeros, and the alert strip is derived (lib/platform/alerts.ts) purely from
 * those real counters.
 */
export default async function PlatformOverviewPage() {
  const [metrics, recent] = await Promise.all([loadPlatformMetrics(), loadRecentActivity()])

  return (
    <>
      <PageHeader
        crumb="Control center"
        title="Platform overview"
        lede="Live operational state across organizers, events, orders, payments, tickets and entry — read directly from the database on every load. This console is read-only: operations stay with the flows that own them."
        actions={
          <>
            <Link className="button button-quiet" href="/platform/system">System status</Link>
            <Link className="button button-dark" href="/platform/docs">Documentation <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden /></Link>
          </>
        }
      />

      {metrics === null ? (
        <UnavailablePanel what="Platform metrics" />
      ) : (
        <>
          <section className="console-section" aria-label="Operational alerts" style={{ marginTop: 0 }}>
            <AlertList alerts={derivePlatformAlerts(metrics)} />
          </section>

          <section className="console-section" aria-label="Orders and payments">
            <SectionHead title="Orders &amp; payments" note="What money has moved" />
            <div className="metric-grid">
              <Metric label="Orders" value={metrics.ordersAll.toLocaleString('en-UG')} note={`${metrics.ordersPaid.toLocaleString('en-UG')} paid`} href="/platform/orders" />
              <Metric accent label="Gross collected" value={formatMoney(Number(metrics.grossCollectedMinor))} note={`${metrics.paymentsSucceeded.toLocaleString('en-UG')} successful payments · pre-fee, provider-collected — not platform revenue`} href="/platform/payments?status=SUCCEEDED" />
              <Metric label="In payment window" value={metrics.ordersAwaitingPayment.toLocaleString('en-UG')} note="Awaiting payment, not yet expired" href="/platform/orders?state=AWAITING_PAYMENT" />
              <Metric label="Payments open" value={metrics.paymentsOpen.toLocaleString('en-UG')} note="Pending or processing at a provider" href="/platform/payments?status=PROCESSING" />
              <Metric label="Payments failed" value={metrics.paymentsFailed.toLocaleString('en-UG')} note="Terminal provider failures" href="/platform/payments?status=FAILED" />
              <Metric label="Orders expired" value={metrics.ordersExpired.toLocaleString('en-UG')} note="Payment window closed unpaid" href="/platform/orders?state=EXPIRED" />
            </div>
          </section>

          <section className="console-section" aria-label="Tickets and entry">
            <SectionHead title="Tickets &amp; entry" note="What the door has seen" />
            <div className="metric-grid">
              <Metric label="Tickets issued" value={metrics.ticketsIssued.toLocaleString('en-UG')} note={`${metrics.ticketsCheckedIn.toLocaleString('en-UG')} checked in`} href="/platform/tickets" />
              <Metric label="Check-ins" value={metrics.checkInsTotal.toLocaleString('en-UG')} note="Verified gate entries" href="/platform/check-ins" />
              <Metric label="Void tickets" value={metrics.ticketsVoid.toLocaleString('en-UG')} note="Never valid at a gate" href="/platform/tickets?status=VOID" />
              <Metric label="Issuance failures" value={metrics.ticketIssuanceFailures.toLocaleString('en-UG')} note="Paid orders that failed to issue" href="/platform/orders" />
              <Metric label="Webhook failures" value={metrics.webhookFailures.toLocaleString('en-UG')} note={metrics.webhooksUnprocessed > 0 ? `${metrics.webhooksUnprocessed} still unprocessed` : 'No unprocessed events'} href="/platform/payments?webhook=FAILED" />
              <Metric label="Audit events" value={metrics.securityEventsTotal.toLocaleString('en-UG')} note="Recorded security events" href="/platform/audit" />
            </div>
          </section>

          <section className="console-section" aria-label="Audience and supply">
            <SectionHead title="Audience &amp; supply" note="Who and what is on the platform" />
            <div className="metric-grid">
              <Metric label="Users" value={metrics.users.toLocaleString('en-UG')} note="Identity profiles" href="/platform/users" />
              <Metric label="Organizers" value={metrics.organizers.toLocaleString('en-UG')} note="Workspaces" href="/platform/organizers" />
              <Metric label="Events" value={metrics.eventsAll.toLocaleString('en-UG')} note={`${metrics.eventsPublic.toLocaleString('en-UG')} public · ${metrics.eventsUpcoming.toLocaleString('en-UG')} upcoming`} href="/platform/events" />
              <Metric label="Selling now" value={metrics.eventsSalesLive.toLocaleString('en-UG')} note="Sales open or event live" href="/platform/events?lifecycle=SALES_OPEN" />
              <Metric label="Pending invitations" value={metrics.invitationsPending.toLocaleString('en-UG')} note={metrics.invitationsExpiredPending > 0 ? `${metrics.invitationsExpiredPending} expired while pending` : 'None expired'} href="/platform/organizers" />
            </div>
          </section>
        </>
      )}

      {recent !== null && (
        <section className="console-section" aria-label="Recent activity">
          <SectionHead title="Recent activity" note="Newest first" />

          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Orders</th><th scope="col">State</th><th scope="col" className="num">Total</th><th scope="col">Placed</th></tr></thead>
              <tbody>
                {recent.orders.length === 0 && <tr><td colSpan={4} className="muted">No orders yet — the board is genuinely empty, not broken.</td></tr>}
                {recent.orders.map((order) => (
                  <tr key={order.publicId}>
                    <td><Link href={`/platform/orders/${order.publicId}`}>{order.orderNumber}</Link><span className="table-cell-sub">{order.purchaserEmail}{order.isGuest ? ' · guest checkout' : ''}</span></td>
                    <td><StatusPill tone={stateTone(order.paymentState)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.paymentState)}</StatusPill></td>
                    <td className="num">{formatMoney(Number(order.totalMinorUnits))}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="platform-scroll" style={{ marginTop: 14 }}>
            <table className="platform-table">
              <thead><tr><th scope="col">Payments</th><th scope="col">Provider</th><th scope="col">Status</th><th scope="col" className="num">Amount</th><th scope="col">Updated</th></tr></thead>
              <tbody>
                {recent.payments.length === 0 && <tr><td colSpan={5} className="muted">No payment records yet.</td></tr>}
                {recent.payments.map((payment) => (
                  <tr key={payment.publicId}>
                    <td><Link href={`/platform/orders/${payment.orderPublicId}`}>{payment.orderNumber}</Link></td>
                    <td>{payment.provider}</td>
                    <td><StatusPill tone={stateTone(payment.status)}>{labelOf({ SUCCEEDED: 'Succeeded', PENDING: 'Pending', PROCESSING: 'Processing', FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }, payment.status)}</StatusPill></td>
                    <td className="num">{formatMoney(Number(payment.amountMinorUnits))}</td>
                    <td>{formatDateTime(payment.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="platform-scroll" style={{ marginTop: 14 }}>
            <table className="platform-table">
              <thead><tr><th scope="col">Events created</th><th scope="col">Organizer</th><th scope="col">Lifecycle</th><th scope="col">Starts</th></tr></thead>
              <tbody>
                {recent.events.length === 0 && <tr><td colSpan={4} className="muted">No events created yet.</td></tr>}
                {recent.events.map((event) => (
                  <tr key={event.publicId}>
                    <td><Link href={`/platform/events/${event.publicId}`}>{event.title}</Link></td>
                    <td>{event.organizerName}</td>
                    <td><StatusPill tone={stateTone(event.lifecycleState)}>{labelOf(LIFECYCLE_LABELS, event.lifecycleState)}</StatusPill></td>
                    <td>{formatDateTime(event.startsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="platform-scroll" style={{ marginTop: 14 }}>
            <table className="platform-table">
              <thead><tr><th scope="col">Audit stream</th><th scope="col">Actor</th><th scope="col">When</th></tr></thead>
              <tbody>
                {recent.audit.length === 0 && <tr><td colSpan={3} className="muted">No security events recorded yet.</td></tr>}
                {recent.audit.map((event) => (
                  <tr key={event.id}>
                    <td><StatusPill tone="brand">{event.eventType}</StatusPill></td>
                    <td>{event.actorName || '—'}<span className="table-cell-sub">{event.actorEmail ?? 'system / unknown actor'}</span></td>
                    <td>{formatDateTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <Link className="button button-quiet" href="/platform/audit">Full audit stream <ArrowUpRight size={14} strokeWidth={2.4} aria-hidden /></Link>
          </div>
        </section>
      )}
    </>
  )
}
