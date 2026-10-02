import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { ApiKeyError, revokeApiKey } from '@/lib/api/manage'
import { logServerError } from '@/lib/server/errors'

export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  if (error instanceof ApiKeyError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  logServerError('api:organizer:api-key-revoke', error)
  return NextResponse.json({ error: 'Unable to revoke the API key' }, { status: 500 })
}

/** DELETE — revoke a key. Revocation is immediate (the /api/v1 auth lookup
 * filters on status = 'ACTIVE') and idempotent for already-revoked keys of
 * this workspace; unknown or foreign key ids → 404. */
export async function DELETE(request: Request, { params }: { params: Promise<{ organizerId: string; keyId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'api-key-revoke'), 10)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  try {
    const context = await requireTicketUGContext()
    const { organizerId, keyId } = await params
    const result = await revokeApiKey(context, organizerId, keyId)
    return NextResponse.json({ status: result.status, alreadyRevoked: result.alreadyRevoked })
  } catch (error) {
    return errorResponse(error)
  }
}
