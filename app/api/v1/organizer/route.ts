import { authenticateApiKey } from '@/lib/api/auth'
import { apiKeyRateHeaders, checkApiKeyRateLimit } from '@/lib/api/rate-limit'
import { v1ErrorResponse, v1Ok, v1RateLimited } from '@/lib/api/http'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** GET /api/v1/organizer — identity card for the presented key: which
 * workspace it belongs to, its scopes, and its display prefix. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof Response) return auth
  const rate = checkApiKeyRateLimit(auth.keyId)
  if (!rate.allowed) {
    return v1ErrorResponse(v1RateLimited(rate.retryAfterSec ?? 60), apiKeyRateHeaders(rate))
  }
  try {
    const detail = await pool.query<{ created_at: string }>(
      `SELECT created_at FROM ticketug.api_key WHERE id = $1`,
      [auth.keyId],
    )
    return v1Ok(
      {
        organizer: { id: auth.organizerId, name: auth.organizerName, slug: auth.organizerSlug },
        key: { prefix: auth.prefix, createdAt: detail.rows[0]?.created_at ?? null, scopes: auth.scopes },
        apiVersion: 'v1',
        readOnly: true,
      },
      undefined,
      apiKeyRateHeaders(rate),
    )
  } catch (error) {
    return v1ErrorResponse(error, apiKeyRateHeaders(rate))
  }
}
