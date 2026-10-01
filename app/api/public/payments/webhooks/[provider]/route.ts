import { NextRequest } from 'next/server'
import { apiErrorResponse, logServerError } from '@/lib/server/errors'
import { applyVerifiedWebhook } from '@/lib/server/payments'

// Payment provider webhook (Pair 6, Supabase-native). Same URL semantics as
// the removed NestJS surface. The raw body is required for HMAC verification
// (the signature covers the exact bytes); verification happens in the provider
// adapter BEFORE anything touches the database, and the transactional core is
// ticketug.apply_payment_event (dedupe, amount/currency/order checks, state
// machines, ticket issuance). In production the only registered provider is
// refused (PROVIDER_NOT_CONFIGURED 503) — no live provider exists yet.
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  try {
    const rawBody = await request.text()
    const body = rawBody ? (JSON.parse(rawBody) as unknown) : null
    const headers = Object.fromEntries(request.headers)
    return Response.json(await applyVerifiedWebhook(provider, headers, body, rawBody))
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ message: 'Malformed webhook' }, { status: 400 })
    // Provider-facing failures are operator-critical (missed webhook = unpaid
    // order): every non-signature failure leaves one log line for triage.
    logServerError(`webhook:${provider}`, error)
    return apiErrorResponse(error)
  }
}
