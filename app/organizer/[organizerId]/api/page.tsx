import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/console/page-head'
import { getTicketUGContext } from '@/lib/request-context'
import { pool } from '@/lib/db'
import { SITE_URL } from '@/lib/site'
import { apiKeyRegistryProvisioned, listApiKeys } from '@/lib/api/manage'
import { ApiKeysManager } from '@/components/organizer/api-keys-manager'

export const dynamic = 'force-dynamic'

/**
 * Developer API surface for one workspace. Credential management is
 * OWNER/MANAGER-only (event staff see an honest notice); every active key is
 * permanently scoped to this organizer — the /api/v1 data layer filters by
 * the key's workspace, so tenant isolation does not depend on client behaviour.
 */
export default async function OrganizerApiPage({ params }: { params: Promise<{ organizerId: string }> }) {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in')
  const { organizerId } = await params
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId && entry.status === 'ACTIVE')
  if (!membership) redirect('/organizer')
  const canManage = membership.role === 'ORGANIZER_OWNER' || membership.role === 'ORGANIZER_MANAGER'

  let provisioned = false
  let keys: Awaited<ReturnType<typeof listApiKeys>> = []
  if (canManage) {
    try {
      provisioned = await apiKeyRegistryProvisioned()
      if (provisioned) keys = await listApiKeys(organizerId)
    } catch {
      provisioned = false
    }
  }
  // Workspace name for the docs copy (best-effort; page still renders without it).
  let organizerName = 'your workspace'
  try {
    const result = await pool.query<{ name: string }>(`SELECT name FROM ticketug.organizer WHERE id = $1`, [organizerId])
    organizerName = result.rows[0]?.name ?? organizerName
  } catch {}

  return (
    <>
      <PageHeader
        crumb="Workspace"
        title="API & Webhooks"
        lede="Developer credentials and the read API for this workspace — every key is scoped to this organizer only."
      />

      {!canManage ? (
        <section className="surface stack" aria-live="polite">
          <h2>Owner or manager access required</h2>
          <p className="muted">
            Developer credentials can be created, rotated and revoked only by workspace owners and managers.
            Your membership role for this workspace is <strong>{membership.role}</strong>.
          </p>
        </section>
      ) : (
        <>
          <section className="console-section" style={{ marginTop: 0 }} aria-label="Getting started">
            <div className="console-section-head">
              <h2>Getting started</h2>
              <span className="muted">Read-only · v1</span>
            </div>
            <div className="surface">
              <p className="muted" style={{ marginTop: 0 }}>
                The Ticket Uganda Developer API lets integrations read this workspace&apos;s events, orders and tickets.
                Create a key below, then authenticate with <code className="api-inline-code">Authorization: Bearer &lt;key&gt;</code>.
                Keys are hashed before storage and shown exactly once at creation.
              </p>
              <div className="api-block"><code>{`curl -H "Authorization: Bearer tug_sk_YOUR_KEY" \\
  ${SITE_URL}/api/v1/organizer`}</code></div>
              <p className="muted" style={{ marginBottom: 0 }}>
                Full endpoint reference: <a className="text-link" href="/developers">/developers</a> · machine-readable contract: <a className="text-link" href="/openapi.json">/openapi.json</a>
              </p>
            </div>
          </section>

          <section className="console-section" aria-label="API keys">
            <div className="console-section-head">
              <h2>Your API keys</h2>
              <span className="muted">Scoped to {organizerName} · revocation is immediate</span>
            </div>
            <ApiKeysManager organizerId={organizerId} initialKeys={keys} provisioned={provisioned} />
          </section>

          <section className="console-section" aria-label="Webhooks">
            <div className="console-section-head">
              <h2>Webhooks</h2>
            </div>
            <div className="surface">
              <p className="muted" style={{ margin: 0 }}>
                Inbound provider webhooks (NylonPay payment confirmations) are handled by Ticket Uganda&apos;s own
                verified webhook endpoint — no configuration is needed in this workspace. Outbound webhooks that
                push events to <em>your</em> systems are <strong>not available yet</strong>; they are on the platform
                roadmap and will appear here when shipped. Nothing on this page pretends otherwise.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  )
}
