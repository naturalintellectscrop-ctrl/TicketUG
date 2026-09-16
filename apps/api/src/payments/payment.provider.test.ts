import { createHmac } from 'node:crypto'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import { TestPaymentProvider } from './payment.provider'

const payload = { eventId: 'evt_1', type: 'payment.updated', attemptReference: 'pat_1', orderReference: 'ord_1', amountMinorUnits: 12500, currency: 'UGX', status: 'SUCCEEDED' }

describe('TestPaymentProvider webhook contract', () => {
  const provider = new TestPaymentProvider()
  const secret = 'phase-11-test-secret'
  const rawBody = JSON.stringify(payload)
  const headers = () => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    return { 'x-payment-timestamp': timestamp, 'x-payment-signature': signature }
  }

  beforeEach(() => { process.env.PAYMENT_TEST_WEBHOOK_SECRET = secret })
  afterEach(() => { delete process.env.PAYMENT_TEST_WEBHOOK_SECRET })

  it('accepts a valid exact-body signature', () => {
    expect(provider.verifyWebhook({ headers: headers(), body: payload, rawBody })).toMatchObject({ providerEventId: 'evt_1', status: 'SUCCEEDED', amountMinorUnits: BigInt(12500) })
  })

  it('rejects a signature generated for a different body', () => {
    const signed = headers()
    expect(() => provider.verifyWebhook({ headers: signed, body: { ...payload, amountMinorUnits: 1 }, rawBody: JSON.stringify({ ...payload, amountMinorUnits: 1 }) })).toThrow(BadRequestException)
  })

  it('rejects malformed payloads', () => {
    expect(() => provider.verifyWebhook({ headers: headers(), body: { eventId: 'evt_1' }, rawBody })).toThrow(BadRequestException)
  })

  it('requires provider configuration', () => {
    delete process.env.PAYMENT_TEST_WEBHOOK_SECRET
    expect(() => provider.verifyWebhook({ headers: headers(), body: payload, rawBody })).toThrow(ServiceUnavailableException)
  })
})
