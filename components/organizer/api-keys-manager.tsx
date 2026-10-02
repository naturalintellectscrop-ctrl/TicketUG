'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Copy, Plus, Trash2 } from 'lucide-react'
import { StatusPill } from '@/components/platform/ui'

type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  status: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

/**
 * Credential manager for one workspace's developer API keys.
 * The raw secret is displayed exactly once (creation response), with an
 * explicit copy step; list views ever after show only the identifying prefix.
 */
export function ApiKeysManager({ organizerId, initialKeys, provisioned }: { organizerId: string; initialKeys: ApiKeyRow[]; provisioned: boolean }) {
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!provisioned) {
    return (
      <div className="surface stack">
        <h3>API registry not provisioned on this deployment yet</h3>
        <p className="muted" style={{ margin: 0 }}>
          The developer API storage (migration <code className="api-inline-code">016-developer-api-keys.sql</code>) has not been
          applied to this deployment&apos;s database, so no credentials can be issued here yet. The operator runs it with
          <code className="api-inline-code">pnpm migrate</code> against the deployment database. Nothing is faked in the
          meantime — there are no keys to list.
        </p>
      </div>
    )
  }

  async function createKey() {
    setError(null)
    if (name.trim().length < 3) {
      setError('Give the key a name of at least 3 characters.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/organizers/${organizerId}/api-keys`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.message ?? body?.error ?? 'The key could not be created.')
        return
      }
      setCreatedKey(body.key as string)
      setKeys((current) => [body.record as ApiKeyRow, ...current])
      setName('')
      setCopied(false)
    } catch {
      setError('The key could not be created — network error.')
    } finally {
      setBusy(false)
    }
  }

  async function revokeKey(key: ApiKeyRow) {
    if (!window.confirm(`Revoke "${key.name}" (${key.prefix}…)? Integrations using it stop working immediately. This cannot be undone.`)) return
    setError(null)
    setBusy(true)
    try {
      const response = await fetch(`/api/organizers/${organizerId}/api-keys/${key.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? body?.error ?? 'The key could not be revoked.')
        return
      }
      setKeys((current) => current.map((entry) => (entry.id === key.id ? { ...entry, status: 'REVOKED', revokedAt: new Date().toISOString() } : entry)))
      router.refresh()
    } catch {
      setError('The key could not be revoked — network error.')
    } finally {
      setBusy(false)
    }
  }

  function copyKey() {
    if (!createdKey) return
    void navigator.clipboard?.writeText(createdKey)
    setCopied(true)
  }

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      {error && <p className="error-text" role="alert">{error}</p>}

      {createdKey && (
        <div className="api-key-reveal" role="status">
          <strong>Copy your new key now — it will not be shown again.</strong>
          <code>{createdKey}</code>
          <div className="row">
            <button type="button" className="button button-dark" onClick={copyKey} disabled={copied}>
              {copied ? <><Check size={14} strokeWidth={2.4} aria-hidden /> Copied</> : <><Copy size={14} strokeWidth={2.4} aria-hidden /> Copy key</>}
            </button>
            <button type="button" className="button button-quiet" onClick={() => setCreatedKey(null)}>Done — I stored it</button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Only a SHA-256 hash of this key is stored. If you lose it, revoke it and create a new one.
          </p>
        </div>
      )}

      <div className="row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name — e.g. “Stock sync service”"
          maxLength={100}
          aria-label="API key name"
          style={{ flex: '1 1 260px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff', padding: '10px 12px', font: 'inherit' }}
          disabled={busy}
        />
        <button type="button" className="button button-primary" onClick={createKey} disabled={busy}>
          <Plus size={14} strokeWidth={2.6} aria-hidden /> Create key
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No API keys yet. Create the first one for an integration that needs your event, order or ticket data.</p>
      ) : (
        <div className="platform-scroll">
          <table className="platform-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Key</th><th scope="col">Scopes</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Last used</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td><code className="api-inline-code">{key.prefix}…</code></td>
                  <td className="muted">{key.scopes.join(', ')}</td>
                  <td><StatusPill tone={key.status === 'ACTIVE' ? 'ok' : 'bad'}>{key.status === 'ACTIVE' ? 'Active' : 'Revoked'}</StatusPill></td>
                  <td>{new Date(key.createdAt).toLocaleDateString('en-UG')}</td>
                  <td>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('en-UG') : <span className="muted">never</span>}</td>
                  <td>
                    {key.status === 'ACTIVE' && (
                      <button type="button" className="button button-quiet" onClick={() => revokeKey(key)} disabled={busy} aria-label={`Revoke ${key.name}`}>
                        <Trash2 size={13} strokeWidth={2.2} aria-hidden /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
