import Link from 'next/link'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel } from '@/components/platform/ui'
import { countExpirableOrders, loadSystemStatus } from '@/lib/platform/queries'
import { formatDateTime } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

/** Truthful system status. Every row is measured or read from the real
 * environment at render time: a live database round-trip with latency, and
 * configuration PRESENCE booleans (never values) for auth, payments, cron
 * and the site URL. There are no decorative green lights — anything this page
 * cannot measure is reported as unknown/unavailable. */
export default async function PlatformSystemPage() {
  const [status, expirable] = await Promise.all([loadSystemStatus(), countExpirableOrders()])

  return (
    <>
      <PageHeader
        crumb="Platform"
        title="System"
        lede="What this deployment can actually reach and what it is actually configured with, measured on every load. Values of secrets are never shown — only whether they exist."
      />

      <section className="console-section" aria-label="Database and authentication status" style={{ marginTop: 0 }}>
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Database</p>
            <dl className="def-list">
              <div><dt>Reachable</dt><dd><StatusPill tone={status.database.reachable ? 'ok' : 'bad'}>{status.database.reachable ? 'Yes' : 'No — queries fail closed'}</StatusPill></dd></div>
              <div><dt>Round-trip</dt><dd>{status.database.latencyMs !== null ? `${status.database.latencyMs} ms` : '—'}</dd></div>
              <div><dt>Database time</dt><dd>{status.database.serverTime ? formatDateTime(status.database.serverTime) : '—'}</dd></div>
            </dl>
            <p className="muted">TLS is pinned to the Supabase root CA; a deployment without a database renders honest unavailable states instead of zeros.</p>
          </article>

          <article className="surface stack">
            <p className="eyebrow">Authentication</p>
            <dl className="def-list">
              <div><dt>Supabase Auth configured</dt><dd><StatusPill tone={status.auth.configured ? 'ok' : 'bad'}>{status.auth.configured ? 'Yes' : 'No — sign-in fails closed'}</StatusPill></dd></div>
            </dl>
            <p className="muted">Sessions are validated server-side on every request; cookies are HttpOnly and never trusted raw.</p>
          </article>
        </div>
      </section>

      <section className="console-section" aria-label="Payment boundary and background work">
        <div className="admin-columns">
          <article className="surface stack">
            <p className="eyebrow">Payment boundary</p>
            <dl className="def-list">
              <div><dt>Selected provider</dt><dd>{status.payment.selectedProvider ? <StatusPill tone="brand">{status.payment.selectedProvider}</StatusPill> : <StatusPill tone="warn">Not selected</StatusPill>}</dd></div>
              <div><dt>NylonPay keys present</dt><dd><StatusPill tone={status.payment.nylonpayConfigured ? 'ok' : 'warn'}>{status.payment.nylonpayConfigured ? 'Configured' : 'Not configured'}</StatusPill></dd></div>
              <div><dt>Webhook secret present</dt><dd><StatusPill tone={status.payment.webhookSecretConfigured ? 'ok' : 'warn'}>{status.payment.webhookSecretConfigured ? 'Configured' : 'Not configured'}</StatusPill></dd></div>
            </dl>
            <p className="muted">The adapter fail-closes (503) without its keys. Provider-side health lives in the NylonPay dashboard — this console does not invent it.</p>
          </article>

          <article className="surface stack">
            <p className="eyebrow">Background work</p>
            <dl className="def-list">
              <div><dt>Expiry sweep secret</dt><dd><StatusPill tone={status.cron.secretConfigured ? 'ok' : 'warn'}>{status.cron.secretConfigured ? 'Configured' : 'Not configured'}</StatusPill></dd></div>
              <div><dt>Orders past their window</dt><dd>{expirable === null ? '—' : expirable > 0 ? <Link href="/platform/orders?state=AWAITING_PAYMENT" className="text-link">{expirable.toLocaleString('en-UG')} awaiting sweep</Link> : '0'}</dd></div>
              <div><dt>Site URL configured</dt><dd><StatusPill tone={status.siteUrlConfigured ? 'ok' : 'warn'}>{status.siteUrlConfigured ? 'Yes' : 'No'}</StatusPill></dd></div>
            </dl>
            <p className="muted">Expiry is enforced lazily on read paths and by <code>POST /api/system/orders/expire-stale</code>, scheduled daily (03:00 UTC) via Vercel Cron — the schedule itself lives in deployment config, not in this app.</p>
          </article>
        </div>
      </section>

      {status.database.reachable ? null : (
        <section className="console-section">
          <UnavailablePanel what="Database-dependent status" />
        </section>
      )}

      <section className="console-section" aria-label="Console boundaries">
        <SectionHead title="What this console deliberately does not do" note="Boundaries" />
        <article className="surface stack platform-prose">
          <ul>
            <li>No state mutation: every lifecycle, order, payment and membership change stays with its owning flow and its transactional SQL function.</li>
            <li>No secrets: environment variables appear only as configured/not-configured.</li>
            <li>No ticket credentials: the QR payload and its hash are never selected by any platform query.</li>
            <li>No provider health fiction: NylonPay-side status lives in the provider dashboard; only webhook intake is observable here.</li>
          </ul>
          <p className="muted">See <Link href="/platform/docs" className="text-link">Docs</Link> for the full architecture and the deferred-features list.</p>
        </article>
      </section>
    </>
  )
}
