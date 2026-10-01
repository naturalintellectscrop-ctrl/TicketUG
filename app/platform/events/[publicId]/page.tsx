import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { loadPlatformEventDetail } from '@/lib/platform/queries'
import { formatDateTime, formatMoney, labelOf, LIFECYCLE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/** Platform drill-down for one event: inventory, gates, staff, orders, entry.
 * Read-only — lifecycle transitions stay with the organizer's own routes and
 * the transactional SQL state machine. */
export default async function PlatformEventDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params
  const detail = await loadPlatformEventDetail(publicId)
  if (!detail) notFound()
  const { event, ticketTypes, gates, staff, orders, checkIns, sales } = detail

  return (
    <main className="platform-shell">
      <p><Link href="/platform/events" className="text-link">← All events</Link></p>
      <header className="section-heading">
        <div>
          <p className="eyebrow">{event.organizerName} · {event.publicId}</p>
          <h1>{event.title}</h1>
          <p className="lede">{formatDateTime(event.startsAt)} → {formatDateTime(event.endsAt)} · {event.timezone} · {event.venueName ?? 'no venue'}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <StatusPill tone={event.publicationState === 'PUBLIC' ? 'ok' : 'info'}>{event.publicationState === 'PUBLIC' ? 'Public listing' : 'Private listing'}</StatusPill>
            <StatusPill tone={stateTone(event.lifecycleState)}>{labelOf(LIFECYCLE_LABELS, event.lifecycleState)}</StatusPill>
            {event.discoverable && <StatusPill tone="brand">Discoverable</StatusPill>}
          </div>
        </div>
      </header>

      <section className="platform-section">
        <div className="metric-grid">
          <article className="surface metric-card"><p className="eyebrow">Paid orders</p><strong>{(sales?.paidOrderCount ?? 0).toLocaleString('en-UG')}</strong><p className="muted">Orders with payment_state PAID</p></article>
          <article className="surface metric-card"><p className="eyebrow">Collected on this event</p><strong>{formatMoney(sales?.paidRevenueMinor ?? 0)}</strong><p className="muted">Paid order totals · pre-fee</p></article>
          <article className="surface metric-card"><p className="eyebrow">Tickets issued</p><strong>{(sales?.ticketsIssued ?? event.ticketsIssued).toLocaleString('en-UG')}</strong><p className="muted">{event.ticketTypeCount} ticket types</p></article>
          <article className="surface metric-card"><p className="eyebrow">Checked in</p><strong>{(sales?.checkedIn ?? 0).toLocaleString('en-UG')}</strong><p className="muted">Verified entries at gates</p></article>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Inventory</p><h2>Ticket types</h2></div></div>
        {ticketTypes.length === 0 ? <p className="muted empty-state">No ticket types configured yet.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Type</th><th scope="col">Price</th><th scope="col" className="num">Capacity</th><th scope="col" className="num">Remaining</th><th scope="col" className="num">Issued</th><th scope="col">On sale</th></tr></thead>
              <tbody>
                {ticketTypes.map((type) => (
                  <tr key={type.id}>
                    <td>{type.name}<span className="table-cell-sub">{type.publicId}</span></td>
                    <td className="num">{formatMoney(Number(type.priceMinorUnits), type.currency)}</td>
                    <td className="num">{type.capacity.toLocaleString('en-UG')}</td>
                    <td className="num">{type.remainingCapacity.toLocaleString('en-UG')}</td>
                    <td className="num">{type.ticketsIssued.toLocaleString('en-UG')}</td>
                    <td><StatusPill tone={type.active ? 'ok' : 'info'}>{type.active ? 'Active' : 'Inactive'}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Door configuration</p><h2>Gates &amp; staff</h2></div></div>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Gates</p>
            {gates.length === 0 ? <p className="muted">No gates configured — ticket types are not gate-scoped.</p> : gates.map((gate) => (
              <div className="row-between" key={gate.id}><span>{gate.name}</span><StatusPill tone={gate.isActive ? 'ok' : 'info'}>{gate.isActive ? 'Active' : 'Inactive'}{gate.ticketTypeCount > 0 ? ` · ${gate.ticketTypeCount} tier${gate.ticketTypeCount === 1 ? '' : 's'}` : ' · unscoped'}</StatusPill></div>
            ))}
          </article>
          <article className="surface stack">
            <p className="eyebrow">Assigned staff</p>
            {staff.length === 0 ? <p className="muted">No event staff assigned.</p> : staff.map((member) => (
              <div className="row-between" key={member.id}><span><Link href={`/platform/users/${member.profileId}`}>{member.displayName || member.email || 'Unnamed profile'}</Link>{member.gateName && <span className="table-cell-sub">Gate: {member.gateName}</span>}</span><StatusPill tone={member.status === 'ACTIVE' ? 'ok' : 'info'}>{member.status}</StatusPill></div>
            ))}
          </article>
        </div>
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Commerce</p><h2>Recent orders</h2></div></div>
        {orders.length === 0 ? <p className="muted empty-state">No orders touch this event yet.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">State</th><th scope="col">Total</th><th scope="col">Placed</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.publicId}>
                    <td><Link href={`/platform/orders/${order.publicId}`}>{order.orderNumber}</Link></td>
                    <td>{order.purchaserEmail}</td>
                    <td><StatusPill tone={stateTone(order.paymentState)}>{labelOf({ AWAITING_PAYMENT: 'Awaiting payment', PAYMENT_PROCESSING: 'Payment processing', PAID: 'Paid', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }, order.paymentState)}</StatusPill></td>
                    <td className="num">{formatMoney(Number(order.totalMinorUnits))}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="platform-section">
        <div className="section-heading"><div><p className="eyebrow">Entry</p><h2>Latest check-ins</h2></div></div>
        {checkIns.length === 0 ? <p className="muted empty-state">No check-ins recorded for this event yet.</p> : (
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Ticket</th><th scope="col">Scanned by</th><th scope="col">When</th></tr></thead>
              <tbody>
                {checkIns.map((checkIn) => (
                  <tr key={checkIn.ticketPublicId}>
                    <td>{checkIn.ticketPublicId}</td>
                    <td>{checkIn.scannerName ?? 'Unknown scanner'}</td>
                    <td>{formatDateTime(checkIn.checkedInAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
