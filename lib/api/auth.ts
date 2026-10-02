import { pool } from '@/lib/db'
import { hashApiKey, isPlausibleApiKey } from '@/lib/api/keys'
import { v1ErrorResponse, v1Unauthorized, v1Unavailable } from '@/lib/api/http'
import { logServerError } from '@/lib/server/errors'

/**
 * Bearer authentication for the developer API.
 *
 * Resolves `Authorization: Bearer tug_sk_…` to the stored credential row and
 * its organizer scope. Every /api/v1 query filters by that organizer_id, so
 * tenant isolation is enforced in the data layer, not by convention.
 *
 * Failure semantics (documented on /developers):
 *   - missing header        → 401 API_KEY_REQUIRED
 *   - malformed / unknown /
 *     revoked key           → 401 API_KEY_INVALID (identical body — a revoked
 *                             and a never-existing key are indistinguishable)
 *   - registry not migrated → 503 API_NOT_PROVISIONED
 *   - database outage       → 503 SERVICE_UNAVAILABLE
 */

export const API_V1_SCOPES = ['events.read', 'orders.read', 'tickets.read'] as const

export type ApiKeyContext = {
  keyId: string
  prefix: string
  scopes: string[]
  organizerId: string
  organizerName: string
  organizerSlug: string
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | Response> {
  const header = request.headers.get('authorization')
  if (!header) {
    return v1ErrorResponse(v1Unauthorized('API_KEY_REQUIRED', 'Include your API key: Authorization: Bearer <key>. Organizer owners and managers create keys in their workspace under API & Webhooks.'))
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const presented = match?.[1]?.trim() ?? ''
  if (!presented || !isPlausibleApiKey(presented)) {
    return v1ErrorResponse(v1Unauthorized('API_KEY_INVALID', 'The presented API key is malformed or does not exist.'))
  }

  let rows: Array<{ id: string; prefix: string; scopes: string[]; organizer_id: string; organizer_name: string; organizer_slug: string }>
  try {
    const result = await pool.query<{
      id: string
      prefix: string
      scopes: string[]
      organizer_id: string
      organizer_name: string
      organizer_slug: string
    }>(
      `SELECT k.id, k.prefix, k.scopes, o.id AS organizer_id, o.name AS organizer_name, o.slug AS organizer_slug
         FROM ticketug.api_key k
         JOIN ticketug.organizer o ON o.id = k.organizer_id
        WHERE k.key_hash = $1 AND k.status = 'ACTIVE'`,
      [hashApiKey(presented)],
    )
    rows = result.rows
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === '42P01') {
      return v1ErrorResponse(v1Unavailable('API_NOT_PROVISIONED', 'The developer API registry is not provisioned on this deployment yet. The operator must apply migration 016.'))
    }
    logServerError('api:v1:auth', error)
    return v1ErrorResponse(v1Unavailable('SERVICE_UNAVAILABLE', 'The credential service is temporarily unavailable. Retry shortly.'))
  }

  const row = rows[0]
  // Revoked and unknown keys land on exactly the same response — no existence leak.
  if (!row) return v1ErrorResponse(v1Unauthorized('API_KEY_INVALID', 'The presented API key is malformed or does not exist.'))

  // Throttled last-used marker: at most one write per key per minute, and a
  // failed bookkeeping write never fails the request.
  pool
    .query(
      `UPDATE ticketug.api_key SET last_used_at = now()
        WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < now() - interval '60 seconds')`,
      [row.id],
    )
    .catch(() => {})

  return {
    keyId: row.id,
    prefix: row.prefix,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    organizerSlug: row.organizer_slug,
  }
}
