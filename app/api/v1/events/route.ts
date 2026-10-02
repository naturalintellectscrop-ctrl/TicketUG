import { authenticateApiKey } from '@/lib/api/auth'
import { apiKeyRateHeaders, checkApiKeyRateLimit } from '@/lib/api/rate-limit'
import { v1ErrorResponse, v1Ok, parseV1Pagination, v1RateLimited } from '@/lib/api/http'
import { listApiEvents } from '@/lib/api/queries'

export const dynamic = 'force-dynamic'

/** GET /api/v1/events — the key's organizer events. Filters: q, lifecycle,
 * publication; paginated with limit/offset (max 100). */
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
    const result = await listApiEvents(auth, {
      q: (url.searchParams.get('q') ?? '').slice(0, 120),
      lifecycle: url.searchParams.get('lifecycle'),
      publication: url.searchParams.get('publication'),
      ...pagination,
    })
    return v1Ok(result.rows, { total: result.total, ...pagination }, apiKeyRateHeaders(rate))
  } catch (error) {
    return v1ErrorResponse(error, apiKeyRateHeaders(rate))
  }
}
