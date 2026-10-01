import Link from 'next/link'
import { Pagination, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { listPlatformOrders, ORDER_PAYMENT_STATES, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime, formatMoney, labelOf, ORDER_PAYMENT_STATE_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; state?: string; page?: string }

/** Platform-wide order explorer. Search covers order number, purchaser email
 * and public id; the state filter mirrors the real payment_state CHECK
 * values. There are deliberately no "change status" controls — order state
 * belongs to checkout, the provider webhook, and the expiry engine. */
export default async function PlatformOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformOrders({ q, state: params.state, page })

  return (
    <main className="platform-shell">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Commerce</p>
          <h1>Orders</h1>
          <p className="lede">Every order with its payment state and provider link. State changes only ever come from checkout, verified provider webhooks, or the expiry sweep — this view explains an order, it never edits one.</p>
        </div>
      </header>

      <form className="filter-bar" method="get" action="/platform/orders" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Order number, email, public id" maxLength={120} /></label>
        <label>Payment state
          <select name="state" defaultValue={params.state ?? ''}>
            <option value="">All states</option>
            {ORDER_PAYMENT_STATES.map((state) => <option key={state} value={state}>{labelOf(ORDER_PAYMENT_STATE_LABELS, state)}</option>)}
          </select>
        </label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} orders</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The order list" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">{q || params.state ? 'No orders match these filters.' : 'No orders exist yet.'}</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">Order</th><th scope="col">Buyer</th><th scope="col">Payment state</th><th scope="col">Provider</th><th scope="col" className="num">Tickets</th><th scope="col" className="num">Total</th><th scope="col">Placed</th></tr></thead>
              <tbody>
                {result.rows.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/platform/orders/${order.publicId}`}>{order.orderNumber}</Link><span className="table-cell-sub">{order.isGuest ? 'guest checkout' : 'signed-in buyer'}</span></td>
                    <td>{order.purchaserEmail}<span className="table-cell-sub">{order.purchaserName}</span></td>
                    <td><StatusPill tone={stateTone(order.paymentState)}>{labelOf(ORDER_PAYMENT_STATE_LABELS, order.paymentState)}</StatusPill></td>
                    <td>{order.paymentStatus ? <StatusPill tone={stateTone(order.paymentStatus)}>{order.paymentStatus}</StatusPill> : <span className="muted">no attempt</span>}</td>
                    <td className="num">{order.ticketsCount}</td>
                    <td className="num">{formatMoney(Number(order.totalMinorUnits), order.currency)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={`/platform/orders${buildFilterQuery({ q, state: params.state })}`} />
        </>
      )}
    </main>
  )
}
