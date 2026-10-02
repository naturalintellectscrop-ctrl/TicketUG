import Link from 'next/link'
import { PageHeader, SectionHead } from '@/components/console/page-head'
import { StatusPill, UnavailablePanel } from '@/components/platform/ui'
import { SITE_URL } from '@/lib/site'
import { pool } from '@/lib/db'
import { formatDateTime } from '@/lib/platform/format'
import { logServerError } from '@/lib/server/errors'

export const dynamic = 'force-dynamic'

type KeyRow = {
  id: string
  name: string
  prefix: string
  status: string
  organizer_name: string
  organizer_id: string
  created_at: string
  last_used_at: string | null
}

/**
 * Platform view of the developer API (API & Integrations): every credential
 * in existence across all organizer workspaces (prefix-only — raw keys are
 * never stored, let alone rendered), the outbound-facing docs, and the
 * inbound provider webhook intake summary. Read-only; key creation/revocation
 * stays with each workspace's owner/manager (audited there).
 */
export default async function PlatformApiPage() {
  let keys: KeyRow[] = []
  let webhookStatuses: Array<{ processing_status: string; count: string }> = []
  let available = true
  try {
    const [keyResult, webhookResult] = await Promise.all([
      pool.query<KeyRow>(
        `SELECT k.id, k.name, k.prefix, k.status, o.name AS organizer_name, o.id AS organizer_id, k.created_at, k.last_used_at
           FROM ticketug.api_key k
           JOIN ticketug.organizer o ON o.id = k.organizer_id
          ORDER BY k.created_at DESC
          LIMIT 100`,
      ),
      pool.query<{ processing_status: string; count: string }>(
        `SELECT processing_status, COUNT(*)::text AS count FROM ticketug.webhook_event GROUP BY processing_status`,
      ),
    ])
    keys = keyResult.rows
    webhookStatuses = webhookResult.rows
  } catch (error) {
    if ((error as { code?: string })?.code === '42P01') {
      available = false
    } else {
      logServerError('page:platform-api', error)
      available = false
    }
  }

  const activeKeys = keys.filter((key) => key.status === 'ACTIVE').length
  const organizersWithKeys = new Set(keys.filter((key) => key.status === 'ACTIVE').map((key) => key.organizer_id)).size

  return (
    <>
      <PageHeader
        crumb="Platform"
        title="API & Integrations"
        lede="The developer API surface: every credential that exists across organizer workspaces, and the inbound payment-webhook intake. Credentials are organizer-scoped and managed by each workspace's owners/managers."
        actions={
          <>
            <Link className="button button-quiet" href="/openapi.json">OpenAPI contract</Link>
            <Link className="button button-dark" href="/developers">Developer docs</Link>
          </>
        }
      />

      {!available ? (
        <UnavailablePanel what="The developer API registry" />
      ) : (
        <>
          <section className="console-section" style={{ marginTop: 0 }} aria-label="API credentials">
            <SectionHead title="Developer API credentials" note={`${activeKeys} active across ${organizersWithKeys} organizer${organizersWithKeys === 1 ? '' : 's'} · showing latest 100`} />
            {keys.length === 0 ? (
              <p className="muted empty-state">No developer API keys exist yet. Organizers create them under their workspace&apos;s API &amp; Webhooks page.</p>
            ) : (
              <div className="platform-scroll">
                <table className="platform-table">
                  <thead><tr><th scope="col">Key</th><th scope="col">Workspace</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Last used</th></tr></thead>
                  <tbody>
                    {keys.map((key) => (
                      <tr key={key.id}>
                        <td>{key.name}<span className="table-cell-sub"><code className="api-inline-code">{key.prefix}…</code></span></td>
                        <td><Link href={`/platform/organizers/${key.organizer_id}`}>{key.organizer_name}</Link></td>
                        <td><StatusPill tone={key.status === 'ACTIVE' ? 'ok' : 'bad'}>{key.status === 'ACTIVE' ? 'Active' : 'Revoked'}</StatusPill></td>
                        <td>{formatDateTime(key.created_at)}</td>
                        <td>{key.last_used_at ? formatDateTime(key.last_used_at) : <span className="muted">never</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="console-section" aria-label="Provider webhook intake">
            <SectionHead title="Payment webhook intake" note="Provider → Ticket Uganda (NylonPay)" />
            {webhookStatuses.length === 0 ? (
              <p className="muted empty-state">No provider webhooks received yet.</p>
            ) : (
              <div className="platform-scroll">
                <table className="platform-table">
                  <thead><tr><th scope="col">Processing status</th><th scope="col" className="num">Events</th></tr></thead>
                  <tbody>
                    {webhookStatuses.map((row) => (
                      <tr key={row.processing_status}>
                        <td><StatusPill tone={row.processing_status === 'PROCESSED' ? 'ok' : row.processing_status === 'REJECTED' || row.processing_status === 'FAILED' ? 'bad' : 'info'}>{row.processing_status}</StatusPill></td>
                        <td className="num">{Number(row.count).toLocaleString('en-UG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
              Envelope counts only — webhook payloads are never rendered in this console. Outbound webhooks (Ticket Uganda → developer
              systems) are deferred and documented as such on /developers.
            </p>
          </section>
        </>
      )}
    </>
  )
}
