import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Developer API — Ticket Uganda',
  description: 'The Ticket Uganda Developer API v1: authentication, endpoints, pagination, rate limits and errors for reading organizer event, order and ticket data.',
}

/**
 * Public developer documentation. EVERY endpoint, shape, code and limit on
 * this page is verified against the implementation (lib/api/*, app/api/v1/*)
 * — this page documents only what exists and explicitly says what does not
 * (outbound webhooks, mutations, sandbox). Kept in lockstep with
 * /openapi.json, which is the machine-readable contract.
 */

const CODE_ROWS: Array<[string, string, string]> = [
  ['API_KEY_REQUIRED', '401', 'No Authorization header was sent. Send `Authorization: Bearer <key>`.'],
  ['API_KEY_INVALID', '401', 'The key is malformed, unknown, or revoked. Revoked and unknown keys are indistinguishable by design.'],
  ['INVALID_PAGINATION', '400', 'limit/offset are missing, non-numeric, or out of range (limit 1-100).'],
  ['INVALID_FILTER', '400', 'A filter value (lifecycle, publication, status, event state) is not one of the documented values.'],
  ['INVALID_REQUEST', '400', 'A path or query parameter could not be interpreted.'],
  ['NOT_FOUND', '404', 'The resource does not exist OR belongs to a different organizer (indistinguishable by design).'],
  ['RATE_LIMITED', '429', 'The per-key rate limit was exceeded. Honour retry-after, then retry.'],
  ['API_NOT_PROVISIONED', '503', 'The API registry (migration 016) has not been applied on this deployment yet.'],
  ['SERVICE_UNAVAILABLE', '503', 'The credential service or database is temporarily unavailable.'],
  ['INTERNAL', '500', 'Unexpected server error. Nothing about the request leaked into the response.'],
]

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-shell">
        <p className="eyebrow">Ticket Uganda for developers</p>
        <h1>Developer API <em>v1</em></h1>
        <p className="lede">
          A read-only, organizer-scoped REST API over Ticket Uganda&apos;s system of record. Integrate your own
          tooling — stock dashboards, reconciliation scripts, door monitors — against the same data the
          platform console sees. Machine-readable contract: <Link className="text-link" href="/openapi.json">/openapi.json</Link> (OpenAPI 3.1).
        </p>

        <div className="platform-prose">
          <h2>1. What this API is</h2>
          <p>
            v1 is <strong>read-only</strong> and <strong>organizer-scoped</strong>. A credential belongs to exactly one
            organizer workspace and can only read that workspace&apos;s events, orders and tickets. There is no
            cross-workspace access, no write operations, and no direct database exposure. Every request is
            authenticated, every query is filtered by the credential&apos;s workspace in the data layer, and key
            creation/revocation is audited.
          </p>
          <h2>2. Who can use it &amp; where credentials come from</h2>
          <p>
            Workspace <strong>owners and managers</strong> create credentials in the Ticket Uganda dashboard:
            sign in → <strong>Your workspaces</strong> → open a workspace → <strong>API &amp; Webhooks</strong> →
            <em> Create key</em>. The full key (<code className="api-inline-code">tug_sk_…</code>) is shown <strong>exactly
            once</strong> at creation; only its SHA-256 hash is stored, and the dashboard always displays just the
            identifying prefix. Keys can be revoked instantly from the same page and issuance/revocation is
            written to the platform audit trail. Platform staff do not issue keys on an organizer&apos;s behalf.
          </p>
          <h2>3. Authentication</h2>
          <p>Send your key as a bearer credential on every request:</p>
          <div className="api-block"><code>{`curl -H "Authorization: Bearer tug_sk_YOUR_KEY" \\
  ${SITE_URL}/api/v1/organizer`}</code></div>
          <p>
            Missing keys → <code className="api-inline-code">401 API_KEY_REQUIRED</code>; malformed, unknown or revoked
            keys → <code className="api-inline-code">401 API_KEY_INVALID</code> (identical body — you cannot probe which
            keys exist). Credential lifecycle: create → use → rotate (create a new key, switch your integration
            over) → revoke the old key. There is no expiry at v1; revocation is the control.
          </p>
          <h2>4. Base URL &amp; versioning</h2>
          <p>
            Base URL: <code className="api-inline-code">{SITE_URL}/api/v1</code>. The version is part of the path;
            breaking changes ship as <code className="api-inline-code">/api/v2</code> with v1 kept alive for a deprecation
            window. Additive fields may appear in responses at any time — parse tolerantly.
          </p>

          <h2>5. Endpoints</h2>
          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/organizer</code> — identity card of the presented key:</p>
          <div className="api-block"><code>{`{
  "data": {
    "organizer": { "id": "…", "name": "Sample Events Ltd", "slug": "sample-events" },
    "key": { "prefix": "tug_sk_Ab12Cd34", "createdAt": "2026-10-02T…", "scopes": ["events.read","orders.read","tickets.read"] },
    "apiVersion": "v1",
    "readOnly": true
  }
}`}</code></div>

          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/events</code> — the workspace&apos;s events. Query: <code className="api-inline-code">q</code> (title/slug search), <code className="api-inline-code">lifecycle</code> (DRAFT · PUBLISHED · SALES_OPEN · SALES_CLOSED · EVENT_LIVE · COMPLETED · CANCELLED · SUSPENDED · ARCHIVED), <code className="api-inline-code">publication</code> (PUBLIC · PRIVATE), pagination:</p>
          <div className="api-block"><code>{`{
  "data": [
    {
      "publicId": "evt_…",
      "title": "Nyege Nyege Warmup",
      "slug": "nyege-warmup",
      "lifecycleState": "SALES_OPEN",
      "publicationState": "PUBLIC",
      "startsAt": "2026-12-31T18:00:00.000Z",
      "endsAt": "2027-01-01T06:00:00.000Z",
      "timezone": "Africa/Kampala",
      "venueName": "Nile Warehouse",
      "ticketTypeCount": 3,
      "ticketsIssued": 214
    }
  ],
  "pagination": { "total": 1, "limit": 25, "offset": 0 }
}`}</code></div>

          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/events/&#123;publicId&#125;</code> — one event with its ticket types (price in minor units, remaining capacity) and live stats (paidOrders, ticketsIssued, checkedIn). Unknown or foreign ids → 404.</p>

          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/orders</code> — orders across the workspace&apos;s events. Query: <code className="api-inline-code">event</code> (public id), <code className="api-inline-code">status</code> (AWAITING_PAYMENT · PAYMENT_PROCESSING · PAID · CANCELLED · EXPIRED), pagination. Returns purchaser name/email/phone (your customers&apos; data — treat it under your privacy obligations), payment state, totals in minor units.</p>

          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/orders/&#123;publicId&#125;</code> — order detail with line items (immutable price/name snapshots) and issued tickets. <strong>Ticket QR credentials are never included</strong> — API keys cannot mint or reproduce tickets.</p>

          <p><span className="api-method" data-method="GET">GET</span> <code className="api-inline-code">/api/v1/tickets</code> — issued-ticket roster across the workspace. Query: <code className="api-inline-code">event</code>, <code className="api-inline-code">status</code> (ISSUED · CHECKED_IN · CANCELLED · REFUNDED · VOID), pagination. Includes attendee name/email snapshots, order reference and check-in state.</p>

          <h2>6. Pagination</h2>
          <p>
            List endpoints take <code className="api-inline-code">limit</code> (1-100, default 25) and{' '}
            <code className="api-inline-code">offset</code>, and answer with{' '}
            <code className="api-inline-code">{"{ data, pagination: { total, limit, offset } }"}</code>. Invalid values are a 400,
            not a silent correction.
          </p>

          <h2>7. Rate limits</h2>
          <p>
            <strong>120 requests per minute per key</strong>, enforced with a fixed window. Every response carries{' '}
            <code className="api-inline-code">x-ratelimit-limit</code>, <code className="api-inline-code">x-ratelimit-remaining</code> and{' '}
            <code className="api-inline-code">x-ratelimit-reset</code>; a blocked request answers{' '}
            <code className="api-inline-code">429 RATE_LIMITED</code> with <code className="api-inline-code">retry-after</code>.
            Deployment note (stated plainly): enforcement is per server instance on our serverless runtime, so treat
            the limit as a pacing budget rather than a hard global ceiling.
          </p>

          <h2>8. Errors</h2>
          <p>Every error is <code className="api-inline-code">{"{ \"error\": { \"code\", \"message\" } }"}</code> with a meaningful HTTP status:</p>
          <table className="api-docs-table">
            <thead><tr><th scope="col">Code</th><th scope="col">HTTP</th><th scope="col">Meaning</th></tr></thead>
            <tbody>
              {CODE_ROWS.map(([code, status, meaning]) => (
                <tr key={code}><td><code>{code}</code></td><td>{status}</td><td>{meaning}</td></tr>
              ))}
            </tbody>
          </table>

          <h2>9. Webhooks</h2>
          <p>
            <strong>Inbound</strong> (payment provider → Ticket Uganda): NylonPay payment confirmations arrive at
            Ticket Uganda&apos;s own HMAC-verified webhook endpoint — that is platform infrastructure and needs no
            developer setup. <strong>Outbound</strong> (Ticket Uganda → your systems): <strong>not available
            yet</strong>. It is the top deferred item; when it ships it will appear in the workspace&apos;s API &amp;
            Webhooks page with signed payloads and documented retries. Nothing here pretends it exists today.
          </p>

          <h2>10. Sandbox &amp; test data</h2>
          <p>
            No hosted sandbox yet (deferred). To experiment, create a free workspace on this deployment, issue a
            key, and read your own test event&apos;s data — the v1 surface is read-only, so experiments cannot damage
            anything. Payment sandboxing exists separately for the Ticket Uganda app itself (provider test mode).
          </p>

          <h2>11. Not available in v1 (honest list)</h2>
          <ul>
            <li>Write operations (create/update events, ticket types, orders) — the dashboard covers them; API mutations are deferred.</li>
            <li>Outbound developer webhooks — deferred (see §9).</li>
            <li>Cross-workspace or platform-level credentials — by design; platform staff use the ops console, not API keys.</li>
            <li>Hosted sandbox — deferred (see §10).</li>
          </ul>
        </div>
      </main>
      <footer className="site-footer mt-auto" style={{ paddingLeft: 'max(32px, calc((100% - 1180px) / 2))', paddingRight: 'max(32px, calc((100% - 1180px) / 2))' }}>
        <Link href="/" className="brand-mark"><span className="brand-dot" aria-hidden="true" />Ticket Uganda</Link>
        <p style={{ margin: 0 }}>Developer API v1 · contract: <Link href="/openapi.json">/openapi.json</Link></p>
      </footer>
    </>
  )
}
