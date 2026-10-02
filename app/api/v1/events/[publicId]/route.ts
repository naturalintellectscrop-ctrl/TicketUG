import { authenticateApiKey } from '@/lib/api/auth'
import { apiKeyRateHeaders, checkApiKeyRateLimit } from '@/lib/api/rate-limit'
import { v1ErrorResponse, v1Ok, v1RateLimited } from '@/lib/api/http'
import { getApiEvent, requireFound } from '@/lib/api/queries'

export const dynamic = 'force-dynamic'

/** GET /api/v1/events/{publicId} — one event with ticket types + live stats,
 * scoped to the key's organizer. Unknown or foreign ids → 404 (no existence
 * leak across tenants). */
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof Response) return auth
  const rate = checkApiKeyRateLimit(auth.keyId)
  if (!rate.allowed) {
    return v1ErrorResponse(v1RateLimited(rate.retryAfterSec ?? 60), apiKeyRateHeaders(rate))
  }
  try {
    const { publicId } = await params
    const detail = requireFound(await getApiEvent(auth, publicId))
    return v1Ok(detail, undefined, apiKeyRateHeaders(rate))
  } catch (error) {
    return v1ErrorResponse(error, apiKeyRateHeaders(rate))
  }
}
