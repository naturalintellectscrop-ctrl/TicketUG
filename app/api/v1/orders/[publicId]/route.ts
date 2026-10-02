import { authenticateApiKey } from '@/lib/api/auth'
import { apiKeyRateHeaders, checkApiKeyRateLimit } from '@/lib/api/rate-limit'
import { v1ErrorResponse, v1Ok, v1RateLimited } from '@/lib/api/http'
import { getApiOrder, requireFound } from '@/lib/api/queries'

export const dynamic = 'force-dynamic'

/** GET /api/v1/orders/{publicId} — order detail with line items and issued
 * tickets. Ticket QR credentials are NEVER included — an API key cannot mint
 * or reproduce a ticket. */
export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const auth = await authenticateApiKey(request)
  if (auth instanceof Response) return auth
  const rate = checkApiKeyRateLimit(auth.keyId)
  if (!rate.allowed) {
    return v1ErrorResponse(v1RateLimited(rate.retryAfterSec ?? 60), apiKeyRateHeaders(rate))
  }
  try {
    const { publicId } = await params
    const detail = requireFound(await getApiOrder(auth, publicId))
    return v1Ok(detail, undefined, apiKeyRateHeaders(rate))
  } catch (error) {
    return v1ErrorResponse(error, apiKeyRateHeaders(rate))
  }
}
