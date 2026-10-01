import Link from 'next/link'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="platform-section platform-prose">
      <div className="section-heading"><div><p className="eyebrow">Reference</p><h2>{title}</h2></div></div>
      {children}
    </section>
  )
}

/** Documentation center for the control center. It documents ONLY what the
 * repository actually implements — endpoint catalog, lifecycles, audit
 * vocabulary, and an explicit deferred list — so an operator is never told a
 * capability exists when it does not. */
export default function PlatformDocsPage() {
  return (
    <main className="platform-shell">
      <header className="section-heading">
        <div>
          <p className="eyebrow">How this platform works</p>
          <h1>Docs</h1>
          <p className="lede">The actual TicketUG architecture as built — not aspirational. Every capability listed here exists in code today; everything not listed is deferred and named as such.</p>
        </div>
      </header>

      <Section title="Architecture">
        <ul>
          <li>Next.js App Router (server components + same-origin <code>/api/*</code> route handlers) deployed on Vercel.</li>
          <li>Supabase Auth for identity; sessions validated server-side on every request (HttpOnly cookies, never trusted raw).</li>
          <li>PostgreSQL (Supabase) with the <code>ticketug</code> schema; money-critical operations run inside transactional SQL functions (<code>create_order</code>, <code>cancel_order</code>, <code>apply_payment_event</code>, <code>transition_event_lifecycle</code>, <code>expire_stale_orders</code>, atomic <code>_issue_paid_tickets</code>).</li>
          <li>The payment provider boundary is an adapter seam: the live provider is NylonPay, selected by <code>PAYMENT_PROVIDER=nylonpay</code>, fail-closed without its keys. There is no second backend — the former NestJS API was intentionally removed.</li>
        </ul>
      </Section>

      <Section title="Roles and permissions">
        <ul>
          <li><code>ATTENDEE</code> — buys tickets, holds tickets.</li>
          <li><code>ORGANIZER_OWNER / ORGANIZER_MANAGER</code> — workspace-scoped event, ticketing, team and sales operations.</li>
          <li><code>EVENT_STAFF</code> — gate scanning for assigned events (optionally gate-scoped).</li>
          <li><code>PLATFORM_SUPPORT / PLATFORM_ADMIN / SUPER_ADMIN</code> — this control center. Platform roles are granted ONLY by the audited provisioning script (<code>scripts/provision-platform-admin.mjs</code>), never through a web form, and every grant writes a security event.</li>
        </ul>
        <p>Authorization is enforced server-side on every page and API route. This console adds no privileges and performs no mutations.</p>
      </Section>

      <Section title="Lifecycles">
        <ul>
          <li><strong>Event:</strong> DRAFT → PUBLISHED → SALES_OPEN → SALES_CLOSED → EVENT_LIVE → COMPLETED, plus CANCELLED / SUSPENDED / ARCHIVED — transitions go through <code>transition_event_lifecycle</code> only, owned by the organizer.</li>
          <li><strong>Order payment state:</strong> AWAITING_PAYMENT → PAYMENT_PROCESSING → PAID, terminal CANCELLED / EXPIRED. Expiry is enforced lazily on read and by the daily sweep.</li>
          <li><strong>Payment:</strong> PENDING → PROCESSING → SUCCEEDED / FAILED / CANCELLED / EXPIRED — terminal states arrive only via signature-verified provider webhooks (HMAC + replay window, idempotent by provider event id).</li>
          <li><strong>Ticket:</strong> ISSUED → CHECKED_IN (exactly once, enforced by a UNIQUE constraint), terminal CANCELLED / REFUNDED / VOID.</li>
        </ul>
      </Section>

      <Section title="API endpoint catalog (real routes)">
        <ul>
          <li><code>/api/auth/sign-in · sign-up · sign-out</code> — session management; sign-in computes the post-login landing server-side from platform role.</li>
          <li><code>/api/orders · /api/orders/[publicId] · cancel · payment</code> — signed-in checkout and status.</li>
          <li><code>/api/orders/guest</code> + <code>/api/public/orders/[publicId] (· cancel · rekey · tickets · pdf)</code> — guest checkout with token-scoped access and recovery.</li>
          <li><code>/api/organizers…</code> — workspace CRUD, events, ticket types, gates, staff, invitations, members, sales summary, lifecycle transitions, ownership transfer.</li>
          <li><code>/api/check-ins</code> — atomic gate verification (scanner role, event/gate scoping).</li>
          <li><code>/api/public/payments/webhooks/[provider]</code> — provider event intake.</li>
          <li><code>/api/system/orders/expire-stale</code> — cron sweep, <code>x-cron-secret</code> protected, fails closed.</li>
          <li><code>/api/health · /api/readiness</code> — liveness/readiness.</li>
        </ul>
        <p>There is no public developer API and no API-key system — see Deferred.</p>
      </Section>

      <Section title="Audit vocabulary (what is actually recorded)">
        <ul>
          <li><code>MEMBERSHIP_CHANGED</code> — organizer membership create/promote/demote/remove/transfer.</li>
          <li><code>PLATFORM_ROLE_GRANTED:&lt;role&gt;</code> — provisioning-script role grants.</li>
          <li>The stream is intentionally small today. The control center renders it verbatim and never invents entries; the webhook stream (<code>webhook_event</code>) and issuance events (<code>ticket_issuance_event</code>) are the system-action audit trails for payments.</li>
        </ul>
      </Section>

      <Section title="Deferred — named honestly, not faked">
        <ul>
          <li><strong>Refunds, settlements, ledger, reconciliation, fees:</strong> the schema has payments (provider-collected, UGX) but no refund/settlement/ledger primitives. &quot;Gross collected&quot; in this console means provider-collected payments, pre-fee, pre-settlement — never platform revenue.</li>
          <li><strong>Public API &amp; API keys:</strong> no API-key authentication architecture exists; building key management without it would be pretend security. Deferred until a signed-key model is designed.</li>
          <li><strong>Notifications:</strong> no email/SMS delivery infrastructure exists (ticket delivery is in-app/PDF); nothing is faked.</li>
          <li><strong>Rejected scan history:</strong> duplicate/rejected scan attempts are rejected at write time and not persisted, so no rejection statistics are shown.</li>
          <li><strong>Platform settings UI:</strong> no setting has a runtime consumer yet; the deployment environment (env vars) is the current configuration surface.</li>
          <li><strong>Account suspension:</strong> no deactivation model exists in the security design; none is simulated here.</li>
        </ul>
      </Section>

      <Section title="Operating the platform">
        <ul>
          <li>Sign in like any user — platform roles land directly here automatically.</li>
          <li>Start at Overview; follow any alert to the surface that explains it.</li>
          <li>Investigation order that answers most questions: order → its payment/attempts → the webhook stream → the event&apos;s check-ins.</li>
          <li>Deep operational reference lives in the repository: <code>docs/ARCHITECTURE.md</code>, <code>docs/SUPABASE_NATIVE_ARCHITECTURE.md</code>, <code>docs/FINAL_PRODUCTION_READINESS_AUDIT.md</code>.</li>
        </ul>
      </Section>
    </main>
  )
}
