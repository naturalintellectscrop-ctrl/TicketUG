import { NextResponse } from 'next/server'
import { requireTicketUGContext } from '@/lib/request-context'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { ApiKeyError, apiKeyRegistryProvisioned, createApiKey, listApiKeys } from '@/lib/api/manage'
import { logServerError } from '@/lib/server/errors'

export const dynamic = 'force-dynamic'

const createKeyInput = z.object({ name: z.string().trim().min(3).max(100) })

function errorResponse(error: unknown) {
  if (error instanceof ApiKeyError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  logServerError('api:organizer:api-keys', error)
  return NextResponse.json({ error: 'Unable to manage API keys' }, { status: 500 })
}

/** GET — list this workspace's API keys (prefix only; raw secrets never leave
 * the creation response). Honest `provisioned: false` when migration 016 has
 * not been applied on this deployment. */
export async function GET(_request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const membership = context.organizerMemberships.find((entry) => entry.organizerId === organizerId)
    if (!membership || membership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!(await apiKeyRegistryProvisioned())) {
      return NextResponse.json({ keys: [], provisioned: false })
    }
    return NextResponse.json({ keys: await listApiKeys(organizerId), provisioned: true })
  } catch (error) {
    return errorResponse(error)
  }
}

/** POST — create a key. The full secret is returned ONCE, in this response
 * only; the stored record keeps its SHA-256 hash and display prefix. */
export async function POST(request: Request, { params }: { params: Promise<{ organizerId: string }> }) {
  const limited = checkRateLimit(rateLimitKey(request, 'api-key-create'), 5)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again shortly.' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  try {
    const context = await requireTicketUGContext()
    const { organizerId } = await params
    const parsed = createKeyInput.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_NAME', message: 'Give the key a name of 3-100 characters.' }, { status: 400 })
    }
    const created = await createApiKey(context, organizerId, parsed.data.name)
    return NextResponse.json(
      { key: created.key, record: created.record, warnOnce: 'Store this key now — it is shown only once and cannot be retrieved later.' },
      { status: 201 },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
