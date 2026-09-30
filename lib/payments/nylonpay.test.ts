import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from '@nile-squad/nylonpay-ts'
import { NylonPayProvider } from './nylonpay'
import { ProviderRegistry } from './provider'
import { ApiError } from '../server/errors'

// NylonPay adapter: webhook verification (raw-body HMAC + replay window),
// event mapping, initiation contract. The in-house verifier is cross-checked
// against the vendor SDK's verifyWebhookSignature on the same inputs so the
// two implementations can never drift apart silently.

const API_KEY = 'npk_test_unit'
const API_SECRET = 'nps_test_unit'
const WEBHOOK_SECRET = 'unit-webhook-secret'
const ATTEMPT_REFERENCE = '6f9619ff-8b86-d011-b42d-00c04fc964ff'

const ENV_KEYS = ['NYLONPAY_API_KEY', 'NYLONPAY_API_SECRET', 'NYLONPAY_WEBHOOK_SECRET', 'PAYMENT_PROVIDER'] as const

beforeAll(() => {
  process.env.NYLONPAY_API_KEY = API_KEY
  process.env.NYLONPAY_API_SECRET = API_SECRET
  process.env.NYLONPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
})
afterAll(() => { for (const key of ENV_KEYS) delete process.env[key] })

function sign(rawBody: string, secret = WEBHOOK_SECRET) {
  return createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex')
}

function makeDelivery(status: string, event: string, overrides: Record<string, unknown> = {}) {
  const body = {
    delivery_id: 'dlv_01',
    event,
    timestamp: new Date().toISOString(),
    payload: {
      transactionId: 'tx_01',
      reference: ATTEMPT_REFERENCE,
      amount: '40000',
      currency: 'UGX',
      status,
      previousStatus: 'processing',
      type: 'collection',
      method: 'mobileMoney',
      mode: 'live',
      failureReason: null,
      failureCategory: null,
      failureCode: null,
      operatorTid: null,
      ...overrides,
    },
  }
  const rawBody = JSON.stringify(body)
  return { body, rawBody, signature: sign(rawBody) }
}

function headersWith(signature: string) { return { 'x-nylon-signature': signature } }

describe('NylonPayProvider.verifyWebhook', () => {
  it('accepts a valid signed webhook and maps transaction.successful → SUCCEEDED', () => {
    const provider = new NylonPayProvider()
    const { body, rawBody, signature } = makeDelivery('successful', 'transaction.successful')
    const event = provider.verifyWebhook({ headers: headersWith(signature), rawBody, body })
    expect(event).toMatchObject({
      providerEventId: 'tx_01:successful',
      eventType: 'transaction.successful',
      providerAttemptReference: ATTEMPT_REFERENCE,
      status: 'SUCCEEDED',
      currency: 'UGX',
      orderReference: '',
    })
    expect(event.amountMinorUnits).toBe(BigInt(40000))
  })

  it('maps failed, cancelled and processing events', () => {
    const provider = new NylonPayProvider()
    for (const [status, event, expected] of [
      ['failed', 'transaction.failed', 'FAILED'],
      ['cancelled', 'transaction.cancelled', 'CANCELLED'],
      ['processing', 'transaction.processing', 'PROCESSING'],
    ] as const) {
      const delivery = makeDelivery(status, event)
      expect(provider.verifyWebhook({ headers: headersWith(delivery.signature), rawBody: delivery.rawBody, body: delivery.body }).status).toBe(expected)
    }
  })

  it('tolerates a sparse amount on PROCESSING events but not on terminal ones', () => {
    const provider = new NylonPayProvider()
    const processing = makeDelivery('processing', 'transaction.processing', { amount: null })
    expect(provider.verifyWebhook({ headers: headersWith(processing.signature), rawBody: processing.rawBody, body: processing.body }).status).toBe('PROCESSING')
    const succeeded = makeDelivery('successful', 'transaction.successful', { amount: null })
    expect(() => provider.verifyWebhook({ headers: headersWith(succeeded.signature), rawBody: succeeded.rawBody, body: succeeded.body })).toThrowError(ApiError)
  })

  it('rejects forged, tampered, uppercase and missing signatures', () => {
    const provider = new NylonPayProvider()
    const delivery = makeDelivery('successful', 'transaction.successful')
    expect(() => provider.verifyWebhook({ headers: headersWith(sign(delivery.rawBody, 'wrong-secret')), rawBody: delivery.rawBody, body: delivery.body })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
    const tampered = JSON.stringify({ ...delivery.body, payload: { ...delivery.body.payload, amount: '1' } })
    expect(() => provider.verifyWebhook({ headers: headersWith(delivery.signature), rawBody: tampered, body: JSON.parse(tampered) })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
    expect(() => provider.verifyWebhook({ headers: headersWith(delivery.signature.toUpperCase()), rawBody: delivery.rawBody, body: delivery.body })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
    expect(() => provider.verifyWebhook({ headers: {}, rawBody: delivery.rawBody, body: delivery.body })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
  })

  it('rejects stale deliveries outside the replay window', () => {
    const provider = new NylonPayProvider()
    const body = { delivery_id: 'dlv_02', event: 'transaction.successful', timestamp: new Date(Date.now() - 10 * 60_000).toISOString(), payload: { transactionId: 'tx_02', reference: ATTEMPT_REFERENCE, amount: '40000', currency: 'UGX', status: 'successful', type: 'collection' } }
    const rawBody = JSON.stringify(body)
    expect(() => provider.verifyWebhook({ headers: headersWith(sign(rawBody)), rawBody, body })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
  })

  it('rejects unrecognized events and unparseable bodies', () => {
    const provider = new NylonPayProvider()
    const weird = makeDelivery('successful', 'payout.completed')
    expect(() => provider.verifyWebhook({ headers: headersWith(weird.signature), rawBody: weird.rawBody, body: weird.body })).toThrowError(/UNRECOGNIZED_WEBHOOK_EVENT/)
    const raw = '{"not":"json'
    expect(() => provider.verifyWebhook({ headers: headersWith(sign(raw)), rawBody: raw, body: null })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
  })

  it('fail-closes 503 without configuration', () => {
    delete process.env.NYLONPAY_API_KEY
    const provider = new NylonPayProvider()
    const delivery = makeDelivery('successful', 'transaction.successful')
    let caught: unknown
    try { provider.verifyWebhook({ headers: headersWith(delivery.signature), rawBody: delivery.rawBody, body: delivery.body }) } catch (error) { caught = error }
    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(503)
    process.env.NYLONPAY_API_KEY = API_KEY
  })
})

describe('NylonPayProvider webhook verifier vs vendor SDK', () => {
  it('agrees with verifyWebhookSignature on valid, forged and stale inputs', () => {
    const provider = new NylonPayProvider()
    const delivery = makeDelivery('successful', 'transaction.successful')
    expect(verifyWebhookSignature({ payload: delivery.rawBody, signature: delivery.signature, secret: WEBHOOK_SECRET })).toBe(true)
    expect(verifyWebhookSignature({ payload: delivery.rawBody, signature: sign(delivery.rawBody, 'nope'), secret: WEBHOOK_SECRET })).toBe(false)

    const stale = { delivery_id: 'dlv_03', event: 'transaction.successful', timestamp: new Date(Date.now() - 10 * 60_000).toISOString(), payload: { transactionId: 'tx_03', reference: ATTEMPT_REFERENCE, amount: '40000', currency: 'UGX', status: 'successful', type: 'collection' } }
    const staleRaw = JSON.stringify(stale)
    const staleSig = sign(staleRaw)
    expect(verifyWebhookSignature({ payload: staleRaw, signature: staleSig, secret: WEBHOOK_SECRET })).toBe(false)
    expect(() => provider.verifyWebhook({ headers: headersWith(staleSig), rawBody: staleRaw, body: stale })).toThrowError(/INVALID_WEBHOOK_SIGNATURE/)
  })
})

describe('NylonPayProvider.initiate', () => {
  const baseInput = { paymentPublicId: 'pay_1', attemptPublicId: 'pat_1', amountMinorUnits: BigInt(40000), currency: 'UGX', orderReference: 'ord_abc', customer: { name: 'Alton', email: 'buyer@example.com', phone: '+256700000000' } }

  it('sends a UUID reference with the customer phone and returns instructions', async () => {
    const calls: Array<Record<string, unknown>> = []
    const provider = new NylonPayProvider((config) => ({
      collectPayment: async (input) => {
        calls.push({ ...input, clientKey: config.apiKey })
        return { reference: (input as { reference: string }).reference, status: 'pending', on: () => null }
      },
    }))
    const initiation = await provider.initiate(baseInput)
    expect(calls[0].amount).toBe(40000)
    expect(calls[0].currency).toBe('UGX')
    expect((calls[0].customer as { phoneNumber: string }).phoneNumber).toBe('+256700000000')
    expect(calls[0].description).toContain('ord_abc')
    expect((calls[0].metadata as Record<string, string>).orderReference).toBe('ord_abc')
    expect(initiation.providerAttemptReference).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(initiation.providerAttemptReference).toBe(calls[0].reference)
    expect(initiation.instructions).toContain('+256700000000')
  })

  it('refuses initiation without a customer phone (422) and without configuration (503)', async () => {
    const provider = new NylonPayProvider(() => ({ collectPayment: async () => ({ on: () => null }) }))
    await expect(provider.initiate({ ...baseInput, customer: { ...baseInput.customer, phone: null } })).rejects.toMatchObject({ status: 422, message: 'CUSTOMER_PHONE_REQUIRED' })
    delete process.env.NYLONPAY_API_KEY
    await expect(provider.initiate(baseInput)).rejects.toMatchObject({ status: 503 })
    process.env.NYLONPAY_API_KEY = API_KEY
  })

  it('surfaces provider creation failures as 502', async () => {
    const provider = new NylonPayProvider(() => ({
      collectPayment: async () => ({
        on: (event: string, handler: (event: unknown) => void) => { if (event === 'error') handler({ error: 'insufficient_balance' }) },
      }),
    }))
    await expect(provider.initiate(baseInput)).rejects.toMatchObject({ status: 502 })
  })
})

describe('ProviderRegistry with the nylonpay adapter', () => {
  it('selects nylonpay from PAYMENT_PROVIDER and refuses unknown providers', () => {
    process.env.PAYMENT_PROVIDER = 'nylonpay'
    try {
      const registry = new ProviderRegistry()
      expect(registry.selected()).toBe('nylonpay')
      expect(registry.get('nylonpay').name).toBe('nylonpay')
      expect(() => registry.get('garbage')).toThrowError(/PROVIDER_NOT_CONFIGURED/)
    } finally {
      delete process.env.PAYMENT_PROVIDER
    }
  })

  it('keeps the production default fail-closed without PAYMENT_PROVIDER', () => {
    expect(new ProviderRegistry().selected()).toBeNull()
  })
})
