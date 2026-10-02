import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, stateTone } from '@/components/platform/ui'
import { loadPlatformOrderDetail } from '@/lib/platform/queries'
import { formatDateTime, formatMoney, labelOf, ORDER_PAYMENT_STATE_LABELS, PAYMENT_STATUS_LABELS, TICKET_STATUS_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/** Full order investigation: buyer, items with price snapshots, the payment
 * record with provider references, every attempt, issued tickets and the
 * issuance audit trail. Ticket credentials are never rendered — the QR
 * payload stays a scanner-side secret. */
export default async function PlatformOrderDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params
  const detail = await loadPlatformOrderDetail(publicId)
  if (!detail) notFound()
  const { order, items, payment, attempts, tickets, issuance } = detail

  return (
    <>
      <PageHeader
        crumb="Orders"
        title={order.orderNumber}
        lede={`${order.purchaserName} · ${order.purchaserEmail}${order.purchaserPhone ? ` · ${order.purchaserPhone}` : ''} · ${order.publicId}`}
        actions={<Link className="button button-quiet" href="/platform/orders">All orders</Link>}
      />

      <div className="row" style={{ marginTop: 0 }}>
        <StatusPill tone={stateTone(order.paymentState)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.paymentState)}</StatusPill>
        <StatusPill tone={order.isGuest ? 'info' : 'brand'}>{order.isGuest ? 'Guest checkout' : 'Signed-in buyer'}</StatusPill>
        {order.buyerEmail && <StatusPill tone="info">Account: {order.buyerEmail}</StatusPill>}
      </div>

      <section className="console-section" aria-label="Order summary" style={{ marginTop: 0 }}>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Order</p>
            <dl className="def-list">
              <div><dt>Total</dt><dd><strong>{formatMoney(Number(order.totalMinorUnits), order.currency)}</strong></dd></div>
              <div><dt>Placed</dt><dd>{formatDateTime(order.createdAt)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDateTime(order.updatedAt)}</dd></div>
              <div><dt>Payment window ends</dt><dd>{order.paymentExpiresAt ? formatDateTime(order.paymentExpiresAt) : '—'}</dd></div>
              <div><dt>Cancelled</dt><dd>{order.cancelledAt ? formatDateTime(order.cancelledAt) : '—'}</dd></div>
            </dl>
          </article>
          <article className="surface stack">
            <p className="eyebrow">Items</p>
            {items.map((item) => (
              <div className="row-between" key={`${item.eventPublicId}-${item.ticketTypeName}`}>
                <span><Link href={`/platform/events/${item.eventPublicId}`}>{item.eventTitle}</Link><span className="table-cell-sub">{item.ticketTypeName} × {item.quantity} @ {formatMoney(Number(item.unitPriceMinorUnits))}</span></span>
                <strong>{formatMoney(Number(item.lineTotalMinorUnits))}</strong>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="console-section" aria-label="Payment record">
        <SectionHead title="Payment record" note="Money" />
        {!payment ? (
          <p className="muted empty-state">No payment record exists for this order — checkout never reached the payment step.</p>
        ) : (
          <div className="admin-columns">
            <article className="surface stack">
              <p className="eyebrow">Payment</p>
              <dl className="def-list">
                <div><dt>Status</dt><dd><StatusPill tone={stateTone(payment.status)}>{labelOf(PAYMENT_STATUS_LABELS, payment.status)}</StatusPill></dd></div>
                <div><dt>Amount</dt><dd>{formatMoney(Number(payment.amountMinorUnits))}</dd></div>
                <div><dt>Provider</dt><dd>{payment.provider}</dd></div>
                <div><dt>Customer reference</dt><dd>{payment.providerCustomerReference ?? '—'}</dd></div>
                <div><dt>Successful reference</dt><dd>{payment.successfulProviderReference ?? '—'}</dd></div>
                <div><dt>Created</dt><dd>{formatDateTime(payment.createdAt)}</dd></div>
                <div><dt>Succeeded</dt><dd>{payment.succeededAt ? formatDateTime(payment.succeededAt) : '—'}</dd></div>
                <div><dt>Failed</dt><dd>{payment.failedAt ? formatDateTime(payment.failedAt) : '—'}</dd></div>
                {payment.failureCode && <div><dt>Failure</dt><dd>{payment.failureCode}: {payment.failureMessage ?? 'no message'}</dd></div>}
              </dl>
            </article>
            <article className="surface stack">
              <p className="eyebrow">Attempts ({attempts.length})</p>
              {attempts.length === 0 ? <p className="muted">No provider attempts recorded.</p> : attempts.map((attempt) => (
                <div className="row-between" key={attempt.publicId}>
                  <span>{attempt.provider}<span className="table-cell-sub">{attempt.providerAttemptReference ?? 'no provider reference'} · {formatDateTime(attempt.initiatedAt)}</span></span>
                  <span><StatusPill tone={stateTone(attempt.status)}>{attempt.status}</StatusPill>{attempt.failureCode && <span className="table-cell-sub">{attempt.failureCode}</span>}</span>
                </div>
              ))}
              <p className="muted">Provider event intake is audited in the webhook stream under Payments.</p>
            </article>
          </div>
        )}
      </section>

      <section className="console-section" aria-label="Tickets and issuance audit">
        <SectionHead title="Tickets &amp; issuance audit" note="Fulfilment" />
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Tickets ({tickets.length})</p>
            {tickets.length === 0 ? <p className="muted">No tickets issued for this order.</p> : tickets.map((ticket) => (
              <div className="row-between" key={ticket.publicId}>
                <span>#{ticket.unitNumber} {ticket.attendeeName}<span className="table-cell-sub">{ticket.ticketTypeName} · {ticket.publicId}</span></span>
                <StatusPill tone={stateTone(ticket.status)}>{labelOf(TICKET_STATUS_LABELS, ticket.status)}</StatusPill>
              </div>
            ))}
          </article>
          <article className="surface stack">
            <p className="eyebrow">Issuance events</p>
            {issuance.length === 0 ? <p className="muted">No issuance events recorded.</p> : issuance.map((event, index) => (
              <div className="row-between" key={index}>
                <span>{event.providerReference}<span className="table-cell-sub">{event.ticketCount} ticket{event.ticketCount === 1 ? '' : 's'} · {formatDateTime(event.createdAt)}</span></span>
                <span><StatusPill tone={event.status === 'ISSUED' ? 'ok' : 'bad'}>{event.status}</StatusPill>{event.errorCode && <span className="table-cell-sub">{event.errorCode}</span>}</span>
              </div>
            ))}
          </article>
        </div>
      </section>
    </>
  )
}
