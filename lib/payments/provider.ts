import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaymentProviderAdapter, ProviderInitiation, VerifiedProviderEvent } from './contracts'
import type { PaymentStatus } from '../rules/payment-rules'
import { ApiError } from '../server/errors'

// Payment provider adapters. Pair 6: the only provider is the non-production
// test adapter (unchanged behavior — staging simulated pathway). A live
// provider remains an explicit GATE decision; the registry refuses every
// provider in production, which keeps the simulated pathway inert where real
// payments will live (503 TEST_PAYMENT_DISABLED / PROVIDER_NOT_CONFIGURED).

function testSecret(): string {
  const secret = process.env.PAYMENT_TEST_WEBHOOK_SECRET ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'ticketug-development-test-only' : null)
  if (!secret) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED')
  return secret
}

export class TestPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'test'
  initiate(input: { paymentPublicId: string; attemptPublicId: string; amountMinorUnits: bigint; currency: string; orderReference: string }): Promise<ProviderInitiation> {
    return Promise.resolve({ providerAttemptReference: `test_${input.attemptPublicId}`, instructions: 'Non-production test adapter only.' })
  }
  signWebhook(body: Record<string, unknown>) {
    const secret = testSecret()
    const rawBody = JSON.stringify(body)
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    return { rawBody, headers: { 'x-payment-signature': signature, 'x-payment-timestamp': timestamp } }
  }
  verifyWebhook(input: { headers: Record<string, string | undefined>; rawBody: string; body: unknown }): VerifiedProviderEvent {
    const secret = testSecret()
    const signature = input.headers['x-payment-signature']
    const timestamp = input.headers['x-payment-timestamp']
    if (!signature || !timestamp || Math.abs(Date.now() - Number(timestamp)) > 300_000) throw new ApiError(400, 'INVALID_WEBHOOK_SIGNATURE')
    const expected = createHmac('sha256', secret).update(`${timestamp}.${input.rawBody}`).digest('hex')
    const a = Buffer.from(signature); const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(400, 'INVALID_WEBHOOK_SIGNATURE')
    const event = input.body as Record<string, unknown>
    if (typeof event.eventId !== 'string' || typeof event.attemptReference !== 'string' || typeof event.orderReference !== 'string' || typeof event.amountMinorUnits !== 'number' || typeof event.currency !== 'string' || typeof event.status !== 'string') throw new ApiError(400, 'Malformed webhook')
    return { providerEventId: event.eventId, eventType: typeof event.type === 'string' ? event.type : 'payment.updated', providerAttemptReference: event.attemptReference, orderReference: event.orderReference, amountMinorUnits: BigInt(event.amountMinorUnits), currency: event.currency, status: event.status as PaymentStatus }
  }
}

export class ProviderRegistry {
  private readonly test = new TestPaymentProvider()
  get(name: string): PaymentProviderAdapter {
    if (name === 'test' && process.env.NODE_ENV !== 'production') return this.test
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED')
  }
  selected() { return process.env.PAYMENT_PROVIDER ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'test' : null) }
  testWebhook(body: Record<string, unknown>) { return this.test.signWebhook(body) }
}
