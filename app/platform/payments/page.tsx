import Link from 'next/link'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { Pagination, StatusPill, UnavailablePanel, stateTone } from '@/components/platform/ui'
import { listPlatformPayments, listPlatformWebhooks, PAYMENT_STATUSES, WEBHOOK_STATUSES, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime, formatMoney, labelOf, PAYMENT_STATUS_LABELS, WEBHOOK_STATUS_LABELS } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { status?: string; webhook?: string; page?: string; wpage?: string }

/** Payment operations: the payment/attempt records the app owns, the webhook
 * intake stream the provider drives, and the provider configuration state.
 * Configuration shows presence booleans only — key values stay in the
 * deployment environment and are never rendered. */
export default async function PlatformPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const wpage = clampPage(Number(params.wpage) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const [payments, webhooks] = await Promise.all([
    listPlatformPayments({ status: params.status, page }),
    listPlatformWebhooks({ status: params.webhook, page: wpage }),
  ])

  const paymentsQuery = buildFilterQuery({ status: params.status, webhook: params.webhook })
  const webhooksQuery = buildFilterQuery({ status: params.status, webhook: params.webhook })

  return (
    <>
      <PageHeader
        crumb="Operations"
        title="Payments"
        lede="Payment records and attempts created by checkout, plus the provider webhook stream that drives them. Initiated, pending, verified, failed are distinct states here — settlement does not exist in the architecture yet and is never implied."
      />

      <section className="console-section" aria-label="Provider configuration" style={{ marginTop: 0 }}>
        <SectionHead title="NylonPay configuration" note="Provider" />
        <div className="admin-columns">
          <article className="surface stack">
            <dl className="def-list">
              <div><dt>Provider seen on records</dt><dd>{payments === null ? '—' : <StatusPill tone="brand">{payments.rows[0]?.provider ?? 'no payments yet'}</StatusPill>}</dd></div>
              <div><dt>Webhook endpoint</dt><dd><code>POST /api/public/payments/webhooks/[provider]</code></dd></div>
            </dl>
            <p className="muted">The production connection (merchant account, KYC, webhook registration inside the NylonPay dashboard) is an external operator step. This page reads application state only — it cannot and does not measure the provider itself.</p>
          </article>
          <article className="surface stack">
            <p className="eyebrow">Webhook intake</p>
            <dl className="def-list">
              <div><dt>Signature verification</dt><dd><StatusPill tone="ok">Enforced — HMAC + replay window</StatusPill></dd></div>
              <div><dt>Failed / rejected events</dt><dd>{webhooks === null ? '—' : webhooks.total > 0 ? <Link href="/platform/payments?webhook=FAILED" className="text-link">{webhooks.total.toLocaleString('en-UG')} — inspect</Link> : '0'}</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <section className="console-section" aria-label="Payment records">
        <SectionHead title="Payments" note="Records" />
        <form className="filter-bar" method="get" action="/platform/payments" role="search">
          <input type="hidden" name="webhook" value={params.webhook ?? ''} />
          <label>Status
            <select name="status" defaultValue={params.status ?? ''}>
              <option value="">All statuses</option>
              {PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{labelOf(PAYMENT_STATUS_LABELS, status)}</option>)}
            </select>
          </label>
          <button className="button button-dark" type="submit">Filter</button>
          {payments && <span className="filter-count">{payments.total.toLocaleString('en-UG')} payments</span>}
        </form>
        {payments === null ? (
          <UnavailablePanel what="The payment list" />
        ) : payments.rows.length === 0 ? (
          <p className="muted empty-state">No payments match this filter.</p>
        ) : (
          <>
            <div className="platform-scroll">
              <table className="platform-table">
                <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col" className="num">Attempts</th><th scope="col" className="num">Amount</th><th scope="col">Provider reference</th><th scope="col">Updated</th></tr></thead>
                <tbody>
                  {payments.rows.map((payment) => (
                    <tr key={payment.publicId}>
                      <td><Link href={`/platform/orders/${payment.orderPublicId}`}>{payment.orderNumber}</Link><span className="table-cell-sub">order state: {labelOf({ AWAITING_PAYMENT: 'Awaiting payment', PAYMENT_PROCESSING: 'Payment processing', PAID: 'Paid', CANCELLED: 'Cancelled', EXPIRED: 'Expired' }, payment.orderPaymentState)}</span></td>
                      <td><StatusPill tone={stateTone(payment.status)}>{labelOf(PAYMENT_STATUS_LABELS, payment.status)}</StatusPill></td>
                      <td className="num">{payment.attemptCount}</td>
                      <td className="num">{formatMoney(Number(payment.amountMinorUnits), payment.currency)}</td>
                      <td className="wrap">{payment.successfulProviderReference ?? <span className="muted">—</span>}</td>
                      <td>{formatDateTime(payment.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={payments.total} baseHref={`/platform/payments${paymentsQuery}`} />
          </>
        )}
      </section>

      <section className="console-section" aria-label="Webhook intake stream">
        <SectionHead title="Webhook stream" note="Provider events" />
        <form className="filter-bar" method="get" action="/platform/payments" role="search">
          <input type="hidden" name="status" value={params.status ?? ''} />
          <label>Processing status
            <select name="webhook" defaultValue={params.webhook ?? ''}>
              <option value="">All statuses</option>
              {WEBHOOK_STATUSES.map((status) => <option key={status} value={status}>{labelOf(WEBHOOK_STATUS_LABELS, status)}</option>)}
            </select>
          </label>
          <button className="button button-dark" type="submit">Filter</button>
          {webhooks && <span className="filter-count">{webhooks.total.toLocaleString('en-UG')} events</span>}
        </form>
        {webhooks === null ? (
          <UnavailablePanel what="The webhook stream" />
        ) : webhooks.rows.length === 0 ? (
          <p className="muted empty-state">No webhook events match this filter.</p>
        ) : (
          <>
            <div className="platform-scroll">
              <table className="platform-table">
                <thead><tr><th scope="col">Provider event</th><th scope="col">Type</th><th scope="col">Processing</th><th scope="col">Signature</th><th scope="col">Reference</th><th scope="col">Received</th><th scope="col">Outcome</th></tr></thead>
                <tbody>
                  {webhooks.rows.map((webhook) => (
                    <tr key={webhook.id}>
                      <td className="wrap">{webhook.providerEventId}<span className="table-cell-sub">{webhook.provider}</span></td>
                      <td>{webhook.eventType}</td>
                      <td><StatusPill tone={stateTone(webhook.processingStatus)}>{labelOf(WEBHOOK_STATUS_LABELS, webhook.processingStatus)}</StatusPill></td>
                      <td><StatusPill tone={webhook.signatureVerified ? 'ok' : 'bad'}>{webhook.signatureVerified ? 'Verified' : 'Unverified'}</StatusPill></td>
                      <td className="wrap">{webhook.providerReference ?? <span className="muted">—</span>}</td>
                      <td>{formatDateTime(webhook.receivedAt)}</td>
                      <td className="wrap">{webhook.processedAt ? <span>Processed {formatDateTime(webhook.processedAt)}</span> : webhook.failureMessage ? <span className="table-cell-sub">{webhook.failureMessage}</span> : <span className="muted">not processed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={wpage} pageSize={PAGE_SIZE} total={webhooks.total} baseHref={`/platform/payments${webhooksQuery}`} pageParam="wpage" />
          </>
        )}
      </section>
    </>
  )
}
