import { pool, withTransaction } from '@/lib/db'
import { generateApiKey } from '@/lib/api/keys'
import type { TicketUGContext } from '@/lib/request-context'

/**
 * Developer API credential lifecycle — the session-authenticated (dashboard)
 * half. Creation/revocation authority: ACTIVE ORGANIZER_OWNER or
 * ORGANIZER_MANAGER of the workspace (canManageOrganizer), enforced HERE and
 * re-checked by the routes. Keys are organizer-scoped forever: a credential
 * can only ever read its own workspace's data through /api/v1.
 *
 * Secrets discipline:
 *   - the raw key is generated here, returned to the caller exactly once, and
 *     only its SHA-256 hash + display prefix are persisted;
 *   - raw keys are never logged and never appear in any list response;
 *   - creation/revocation write security_event rows (API_KEY_CREATED /
 *     API_KEY_REVOKED) — the event_type column has no CHECK constraint
 *     (migration 000), so new audit types are safe.
 */

export const API_KEY_LIMIT_PER_ORGANIZER = 20

export type ApiKeyRecord = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  status: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

function mapKeyRow(row: { id: string; name: string; prefix: string; scopes: string[]; status: string; created_at: string; last_used_at: string | null; revoked_at: string | null }): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    status: row.status,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }
}

export async function listApiKeys(organizerId: string): Promise<ApiKeyRecord[]> {
  const result = await pool.query<{
    id: string
    name: string
    prefix: string
    scopes: string[]
    status: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
  }>(
    `SELECT id, name, prefix, scopes, status, created_at, last_used_at, revoked_at
       FROM ticketug.api_key
      WHERE organizer_id = $1
      ORDER BY created_at DESC`,
    [organizerId],
  )
  return result.rows.map(mapKeyRow)
}

export type CreatedApiKey = { record: ApiKeyRecord; key: string }

export class ApiKeyError extends Error {
  readonly code: string
  readonly status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiKeyError'
    this.status = status
    this.code = code
  }
}

export async function createApiKey(context: TicketUGContext, organizerId: string, name: string): Promise<CreatedApiKey> {
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId)
  if (!membership || membership.status !== 'ACTIVE' || !['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'].includes(membership.role)) {
    throw new ApiKeyError(403, 'FORBIDDEN', 'Only workspace owners and managers can manage developer credentials.')
  }
  return withTransaction(async (client) => {
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ticketug.api_key WHERE organizer_id = $1 AND status = 'ACTIVE'`,
      [organizerId],
    )
    if (Number(countResult.rows[0]?.count ?? 0) >= API_KEY_LIMIT_PER_ORGANIZER) {
      throw new ApiKeyError(409, 'KEY_LIMIT_REACHED', `This workspace already has ${API_KEY_LIMIT_PER_ORGANIZER} active API keys. Revoke one before creating another.`)
    }
    const generated = generateApiKey()
    const insertResult = await client.query<{ id: string; name: string; prefix: string; scopes: string[]; status: string; created_at: string; last_used_at: string | null; revoked_at: string | null }>(
      `INSERT INTO ticketug.api_key (organizer_id, created_by, name, prefix, key_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, prefix, scopes, status, created_at, last_used_at, revoked_at`,
      [organizerId, context.profileId, name, generated.prefix, generated.keyHash],
    )
    const record = mapKeyRow(insertResult.rows[0])
    await client.query(`INSERT INTO ticketug.security_event (user_profile_id, event_type) VALUES ($1, 'API_KEY_CREATED')`, [context.profileId])
    return { record, key: generated.key }
  })
}

export type RevokeResult = { status: 'REVOKED'; alreadyRevoked: boolean }

export async function revokeApiKey(context: TicketUGContext, organizerId: string, keyId: string): Promise<RevokeResult> {
  const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId)
  if (!membership || membership.status !== 'ACTIVE' || !['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'].includes(membership.role)) {
    throw new ApiKeyError(403, 'FORBIDDEN', 'Only workspace owners and managers can manage developer credentials.')
  }
  return withTransaction(async (client) => {
    const revoked = await client.query<{ id: string }>(
      `UPDATE ticketug.api_key
          SET status = 'REVOKED', revoked_at = now(), revoked_by = $3
        WHERE id = $1 AND organizer_id = $2 AND status = 'ACTIVE'
        RETURNING id`,
      [keyId, organizerId, context.profileId],
    )
    if (revoked.rows[0]) {
      await client.query(`INSERT INTO ticketug.security_event (user_profile_id, event_type) VALUES ($1, 'API_KEY_REVOKED')`, [context.profileId])
      return { status: 'REVOKED' as const, alreadyRevoked: false }
    }
    // Distinguish "already revoked" (idempotent success) from "not ours / unknown" (404).
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM ticketug.api_key WHERE id = $1 AND organizer_id = $2`,
      [keyId, organizerId],
    )
    if (!existing.rows[0]) throw new ApiKeyError(404, 'KEY_NOT_FOUND', 'No such API key in this workspace.')
    return { status: 'REVOKED' as const, alreadyRevoked: true }
  })
}

/** Has migration 016 been applied on this deployment? Used by the dashboard to
 * show an honest "not provisioned" state instead of a fake empty key list. */
export async function apiKeyRegistryProvisioned(): Promise<boolean> {
  try {
    await pool.query('SELECT 1 FROM ticketug.api_key LIMIT 1')
    return true
  } catch (error) {
    if ((error as { code?: string })?.code === '42P01') return false
    throw error
  }
}
