import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createNylonPay } from '@nile-squad/nylonpay-ts'
import type { PaymentProviderAdapter, ProviderCustomer, ProviderInitiation, VerifiedProviderEvent } from './contracts'
import type { PaymentStatus } from '../rules/payment-rules'
import { ApiError, unprocessable } from '../server/errors'

// NylonPay live adapter (NEXT PAYMENT INTEGRATION PHASE). The provider decision
// gate (CONTINUITY §22 row 6) was closed by NI supplying production
// credentials; the integration goes through the existing seam:
//
//   initiate  → official SDK collectPayment (mobile-money push to the
//               purchaser's phone); the attempt's UUID reference comes back
//               verbatim in every webhook payload, which is what the
//               transactional core (ticketug.apply_payment_event) matches on.
//   webhook   → HMAC-SHA256 over the RAW body bytes (lowercase hex,
//               timing-safe) + replay protection on the signed body timestamp
//               — implemented here, byte-identical to the vendor SDK's
//               verifier, so the money gate never depends on third-party code
//               for signature checks. Cross-checked against
//               verifyWebhookSignature in the unit tests.
//
// Server-side polling is disabled (maxPollAttempts: 0): payment state moves
// ONLY through verified webhooks, never from a browser signal and never from
// an SDK event loop.

const DEFAULT_TOLERANCE_SECONDS = 300 // matches the vendor default replay window

export type NylonPayConfig = {
  apiKey: string
  apiSecret: string
  webhookSecret: string
  baseUrl?: string
  toleranceSeconds?: number
}

export function readNylonPayConfig(): NylonPayConfig | null {
  const apiKey = process.env.NYLONPAY_API_KEY?.trim()
  const apiSecret = process.env.NYLONPAY_API_SECRET?.trim()
  const webhookSecret = process.env.NYLONPAY_WEBHOOK_SECRET?.trim()
  if (!apiKey || !apiSecret || !webhookSecret) return null
  return {
    apiKey,
    apiSecret,
    webhookSecret,
    baseUrl: process.env.NYLONPAY_BASE_URL?.trim() || undefined,
    toleranceSeconds: process.env.NYLONPAY_WEBHOOK_TOLERANCE_SECONDS ? Number(process.env.NYLONPAY_WEBHOOK_TOLERANCE_SECONDS) : undefined,
  }
}

type PaymentInstanceLike = { on(event: string, handler: (event: unknown) => void): unknown }
type CollectClient = { collectPayment(input: Record<string, unknown>): Promise<PaymentInstanceLike> }
type ClientFactory = (config: NylonPayConfig) => CollectClient

const defaultClientFactory: ClientFactory = (config) =>
  createNylonPay({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    timeoutMs: 15_000,
    maxRetries: 2,
    maxPollAttempts: 0, // webhook-driven state only — no server-side polling
  }) as unknown as CollectClient

export class NylonPayProvider implements PaymentProviderAdapter {
  readonly name = 'nylonpay'
  private readonly clientFactory: ClientFactory
  private client: CollectClient | null = null
  private clientKey = ''

  constructor(clientFactory?: ClientFactory) {
    this.clientFactory = clientFactory ?? defaultClientFactory
  }

  private getClient(config: NylonPayConfig): CollectClient {
    const key = `${config.apiKey}:${config.apiSecret}:${config.baseUrl ?? ''}`
    if (!this.client || this.clientKey !== key) {
      this.client = this.clientFactory(config)
      this.clientKey = key
    }
    return this.client
  }

  async initiate(input: { paymentPublicId: string; attemptPublicId: string; amountMinorUnits: bigint; currency: string; orderReference: string; customer?: ProviderCustomer }): Promise<ProviderInitiation> {
    const config = readNylonPayConfig()
    if (!config) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED')
    const phone = input.customer?.phone?.trim()
    if (!phone) throw unprocessable('CUSTOMER_PHONE_REQUIRED')
    const email = input.customer?.email?.trim()
    const name = input.customer?.name?.trim()

    // NylonPay reference must be a UUID and is echoed in every webhook — it is
    // the join key the transactional core matches provider_attempt_reference on.
    const reference = randomUUID()
    const client = this.getClient(config)
    const payment = await client.collectPayment({
      amount: Number(input.amountMinorUnits), // UGX has no minor-unit exponent — minor units are whole shillings
      currency: input.currency,
      description: `Ticket Uganda order ${input.orderReference}`.slice(0, 140),
      customer: { name: name && name.length > 0 ? name : 'Ticket Uganda customer', phoneNumber: phone, ...(email ? { email } : {}) },
      reference,
      metadata: { orderReference: input.orderReference, paymentPublicId: input.paymentPublicId, attemptPublicId: input.attemptPublicId },
    })

    // The SDK reports creation failures as an 'error' event fired on a
    // setTimeout(0) — settle the microtask queue and catch it deterministically.
    const failure = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 100)
      payment.on('error', (event) => {
        clearTimeout(timer)
        const message = (event as { error?: unknown } | null | undefined)?.error
        resolve(typeof message === 'string' && message.length > 0 ? message : 'PROVIDER_INITIATION_FAILED')
      })
    })
    if (failure) throw new ApiError(502, `PROVIDER_INITIATION_FAILED: ${failure.slice(0, 200)}`)

    return {
      providerAttemptReference: reference,
      instructions: `A mobile money prompt has been sent to ${phone}. Enter your PIN to approve the payment — this page updates automatically.`,
      // Persisted on the attempt (provider_metadata) so status polling keeps
      // showing the instructions after the initiating tab is gone.
      metadata: { orderReference: input.orderReference, paymentPublicId: input.paymentPublicId, attemptPublicId: input.attemptPublicId, instructions: `A mobile money prompt has been sent to ${phone}. Enter your PIN to approve the payment — this page updates automatically.` },
    }
  }

  verifyWebhook(input: { headers: Record<string, string | undefined>; rawBody: string; body: unknown }): VerifiedProviderEvent {
    const config = readNylonPayConfig()
    if (!config) throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED')
    const signature = input.headers['x-nylon-signature']
    if (!signature || !this.verifySignature(input.rawBody, signature, config.webhookSecret, config.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) {
      throw new ApiError(400, 'INVALID_WEBHOOK_SIGNATURE')
    }

    const body = input.body as { delivery_id?: unknown; event?: unknown; payload?: Record<string, unknown>; timestamp?: unknown } | null
    if (!body || typeof body !== 'object') throw new ApiError(400, 'Malformed webhook')
    const payload = body.payload
    if (!payload || typeof payload !== 'object') throw new ApiError(400, 'Malformed webhook')

    const event = typeof body.event === 'string' ? body.event : ''
    const transactionId = typeof payload.transactionId === 'string' ? payload.transactionId : ''
    const reference = typeof payload.reference === 'string' ? payload.reference : ''
    const amountRaw = payload.amount
    const currency = typeof payload.currency === 'string' ? payload.currency : ''
    const status = typeof payload.status === 'string' ? payload.status : ''
    if (!event || !transactionId || !reference || !currency) throw new ApiError(400, 'Malformed webhook')

    const statusMapped = NYLON_EVENT_STATUS[event]
    if (!statusMapped) throw new ApiError(400, 'UNRECOGNIZED_WEBHOOK_EVENT')

    // In-flight notifications may arrive with a sparse payload (amount can be
    // null per the vendor docs) — the transactional core records them without
    // touching payment state, so the amount is irrelevant there.
    let amountMinorUnits = BigInt(0)
    if (statusMapped !== 'PROCESSING') {
      if (typeof amountRaw !== 'string' || !/^[0-9]+$/.test(amountRaw)) throw new ApiError(400, 'Malformed webhook')
      amountMinorUnits = BigInt(amountRaw)
    }

    return {
      // Delivery attempts can repeat with fresh delivery ids; the transaction
      // id + status pair is the true event identity, so retries land as
      // DUPLICATE in webhook_event instead of double-firing fulfilment.
      providerEventId: `${transactionId}:${status}`,
      eventType: event,
      providerAttemptReference: reference,
      status: statusMapped as PaymentStatus,
      amountMinorUnits,
      currency,
      orderReference: '', // not carried by NylonPay payloads — resolved server-side (payments.ts) before the SQL cross-check
    }
  }

  // Byte-identical to the vendor verifier (verified against @nile-squad/nylonpay-ts
  // source + cross-checked in nylonpay.test.ts): HMAC-SHA256(secret, rawBodyBytes),
  // lowercase-hex, timing-safe comparison, replay window on the signed body timestamp.
  private verifySignature(rawBody: string, signature: string, secret: string, toleranceSeconds: number): boolean {
    if (signature !== signature.toLowerCase()) return false
    const expected = createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex')
    const provided = Buffer.from(signature, 'hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    if (provided.length !== expectedBuf.length) return false
    if (!timingSafeEqual(provided, expectedBuf)) return false
    let parsed: unknown
    try { parsed = JSON.parse(rawBody) } catch { return false }
    const timestamp = (parsed as { timestamp?: unknown } | null)?.timestamp
    const ms = typeof timestamp === 'string' ? Date.parse(timestamp) : Number.NaN
    if (!Number.isFinite(ms)) return false
    return Math.abs(Date.now() - ms) <= toleranceSeconds * 1000
  }
}

const NYLON_EVENT_STATUS: Record<string, string> = {
  'transaction.successful': 'SUCCEEDED',
  'transaction.failed': 'FAILED',
  'transaction.cancelled': 'CANCELLED',
  'transaction.processing': 'PROCESSING', // recorded + IGNORED by migration 013 — in-flight state never mutates payment state
}
