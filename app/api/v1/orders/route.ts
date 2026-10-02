import { authenticateApiKey } from '@/lib/api/auth'
import { apiKeyRateHeaders, checkApiKeyRateLimit } from '@/lib/api/rate-limit'
import { v1ErrorResponse, v1Ok, parseV1Pagination, v1RateLimited } from '@/lib/api/http'
import { listApiOrders } from '@/lib/api/queries'

export const dynamic = 'force-dynamic'

/** GET /api/v1/orders — orders across the key's organizer events.
 * Filters: event (public id), status (payment state); paginated. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof Response) return auth
  const rate = checkApiKeyRateLimit(auth.keyId)
  if (!rate.allowed) {
    return v1ErrorResponse(v1RateLimited(rate.retryAfterSec ?? 60), apiKeyRateHeaders(rate))
  }
  try {
    const url = new URL(request.url)
    const pagination = parseV1Pagination(url.searchParams)
    const result = await listApiOrders(auth, {
      event: url.searchParams.get('event'),
      status: url.searchParams.get('status'),
      ...pagination,
    })
    return v1Ok(result.rows, { total: result.total, ...pagination }, apiKeyRateHeaders(rate))
  } catch (error) {
    return v1ErrorResponse(error, apiKeyRateHeaders(rate))
  }
}
