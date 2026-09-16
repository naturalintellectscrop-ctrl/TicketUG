import { createHmac, timingSafeEqual } from 'node:crypto'
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { PaymentProviderAdapter, ProviderInitiation, VerifiedProviderEvent } from './payment.contracts'
import type { PaymentStatus } from './payment.rules'

export class TestPaymentProvider implements PaymentProviderAdapter {
  readonly name = 'test'
  initiate(input: { paymentPublicId: string; attemptPublicId: string; amountMinorUnits: bigint; currency: string; orderReference: string }): Promise<ProviderInitiation> {
    return Promise.resolve({ providerAttemptReference: `test_${input.attemptPublicId}`, instructions: 'Non-production test adapter only.' })
  }
  signWebhook(body: Record<string, unknown>) {
    const secret = process.env.PAYMENT_TEST_WEBHOOK_SECRET ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'ticketug-development-test-only' : null)
    if (!secret) throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED')
    const rawBody = JSON.stringify(body)
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    return { rawBody, headers: { 'x-payment-signature': signature, 'x-payment-timestamp': timestamp } }
  }
  verifyWebhook(input: { headers: Record<string, string | undefined>; rawBody: string; body: unknown }): VerifiedProviderEvent {
    const secret = process.env.PAYMENT_TEST_WEBHOOK_SECRET ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'ticketug-development-test-only' : null)
    if (!secret) throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED')
    const signature = input.headers['x-payment-signature']
    const timestamp = input.headers['x-payment-timestamp']
    if (!signature || !timestamp || Math.abs(Date.now() - Number(timestamp)) > 300_000) throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE')
    const expected = createHmac('sha256', secret).update(`${timestamp}.${input.rawBody}`).digest('hex')
    const a = Buffer.from(signature); const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE')
    const event = input.body as Record<string, unknown>
    if (typeof event.eventId !== 'string' || typeof event.attemptReference !== 'string' || typeof event.orderReference !== 'string' || typeof event.amountMinorUnits !== 'number' || typeof event.currency !== 'string' || typeof event.status !== 'string') throw new BadRequestException('Malformed webhook')
    return { providerEventId: event.eventId, eventType: typeof event.type === 'string' ? event.type : 'payment.updated', providerAttemptReference: event.attemptReference, orderReference: event.orderReference, amountMinorUnits: BigInt(event.amountMinorUnits), currency: event.currency, status: event.status as PaymentStatus }
  }
}

@Injectable()
export class ProviderRegistry {
  private readonly test = new TestPaymentProvider()
  get(name: string): PaymentProviderAdapter {
    if (name === 'test' && process.env.NODE_ENV !== 'production') return this.test
    throw new ServiceUnavailableException('PROVIDER_NOT_CONFIGURED')
  }
  selected() { return process.env.PAYMENT_PROVIDER ?? (process.env.NODE_ENV !== 'production' && process.env.PAYMENT_MODE === 'test' ? 'test' : null) }
  testWebhook(body: Record<string, unknown>) { return this.test.signWebhook(body) }
}
