import { randomBytes, randomUUID } from 'node:crypto'
import { pool, withTransaction } from '@/lib/db'
import { ProviderRegistry } from '@/lib/payments/provider'
import { paymentDeadline } from '@/lib/rules/order-rules'
import type { PaymentStatus } from '@/lib/rules/payment-rules'
import { badRequest, conflict, notFound, serviceUnavailable, unprocessable } from '@/lib/server/errors'
import { hashGuestToken } from '@/lib/server/orders'

// Payment domain — Supabase-native replacement for the removed NestJS
// PaymentsService. Invariants preserved verbatim:
//   * order locked FOR UPDATE before any decision; PAID/CANCELLED/EXPIRED are
//     hard stops (mode-specific messages match the previous API exactly);
//   * payment rows are 1-per-order (ON CONFLICT DO NOTHING), attempts carry
//     idempotency keys (UNIQUE(payment_id, idempotency_key));
//   * the provider call participates in the transaction (rollback on failure);
//   * issuance happens ONLY through ticketug.apply_payment_event (the verified
//     webhook core), never from a browser signal;
//   * the simulated provider is REFUSED in production (503 TEST_PAYMENT_DISABLED).

export type InitiatePaymentBody = { idempotencyKey: string; provider?: string }

type Actor = { profileId: string } | { guestTokenHash: string }

const paymentSelect = `p.id, p.public_id, p.order_id, o.public_id AS order_public_id, o.order_number, p.amount_minor_units, p.currency, p.provider, p.status, o.payment_expires_at`

type PaymentRow = { id: string; public_id: string; order_id: string; order_public_id: string; order_number: string; amount_minor_units: string; currency: string; provider: string; status: PaymentStatus; payment_expires_at: string | null; attempt_public_id?: string | null; attempt_status?: PaymentStatus | null; provider_attempt_reference?: string | null; attempt_metadata?: unknown }

function attemptInstructions(row: PaymentRow): string | undefined {
  const metadata = row.attempt_metadata as Record<string, unknown> | null | undefined
  const instructions = metadata && typeof metadata === 'object' ? metadata.instructions : undefined
  return typeof instructions === 'string' && instructions.length > 0 ? instructions : undefined
}

function present(row: PaymentRow) {
  const base = {
    paymentId: row.public_id,
    attemptId: row.attempt_public_id,
    status: row.status,
    attemptStatus: row.attempt_status,
    provider: row.provider,
    providerAttemptReference: row.provider_attempt_reference,
    amountMinorUnits: Number(row.amount_minor_units),
    currency: row.currency,
    orderId: row.order_public_id,
    orderNumber: row.order_number,
  }
  const instructions = attemptInstructions(row)
  return instructions ? { ...base, instructions } : base
}

async function lazyExpire(publicId: string) {
  await pool.query('SELECT ticketug.expire_order_if_due($1::text) AS r', [publicId])
}

async function loadOrder(actor: Actor, publicId: string) {
  const filter = 'profileId' in actor
    ? 'o.public_id = $1 AND o.user_profile_id = $2'
    : 'o.public_id = $1 AND o.user_profile_id IS NULL AND o.guest_access_token_hash = $2'
  const result = await pool.query<{ id: string; public_id: string; order_number: string; user_profile_id: string | null; status: string; payment_expires_at: string | null; total_minor_units: string; currency: string; purchaser_name: string; purchaser_email: string; purchaser_phone: string | null }>(
    `SELECT id, public_id, order_number, user_profile_id, status, payment_expires_at, total_minor_units, currency, purchaser_name, purchaser_email, purchaser_phone FROM ticketug.order o WHERE ${filter}`,
    'profileId' in actor ? [publicId, actor.profileId] : [publicId, actor.guestTokenHash],
  )
  const order = result.rows[0]
  if (!order) throw notFound('Order not found')
  return order
}

// Unified initiation (user + guest). The previous implementation had two
// near-identical code paths; this unified sequence preserves every observable
// response (status codes + bodies) — the order row is locked FOR UPDATE for the
// whole transaction, so no interleaving is possible. Idempotent replays return
// the original attempt regardless of its current status (the safer of the two
// previous behaviors — documented in the architecture doc).
export async function initiatePayment(actor: Actor, publicId: string, body: InitiatePaymentBody) {
  const registry = new ProviderRegistry()
  const providerName = body.provider ?? registry.selected()
  if (!providerName) throw serviceUnavailable('PROVIDER_NOT_CONFIGURED')
  const provider = registry.get(providerName)
  const order = await loadOrder(actor, publicId)
  await lazyExpire(publicId)

  return withTransaction(async (client) => {
    const locked = (await client.query<{ id: string; public_id: string; order_number: string; user_profile_id: string | null; status: string; payment_expires_at: string | null; total_minor_units: string; currency: string; purchaser_name: string; purchaser_email: string; purchaser_phone: string | null }>(
      'SELECT id, public_id, order_number, user_profile_id, status, payment_expires_at, total_minor_units, currency, purchaser_name, purchaser_email, purchaser_phone FROM ticketug.order WHERE id = $1 FOR UPDATE',
      [order.id],
    )).rows[0]
    if ('profileId' in actor && locked.status === 'PAID') throw conflict('PAYMENT_ALREADY_SUCCEEDED')
    if (['PAID', 'CANCELLED', 'EXPIRED'].includes(locked.status)) throw conflict('ORDER_EXPIRED')

    const paymentId = randomUUID()
    const paymentPublicId = `pay_${randomBytes(12).toString('hex')}`
    const attemptId = randomUUID()
    const attemptPublicId = `pat_${randomBytes(12).toString('hex')}`
    await client.query(
      'INSERT INTO ticketug.payment(id, public_id, order_id, provider, amount_minor_units, currency) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (order_id) DO NOTHING',
      [paymentId, paymentPublicId, locked.id, providerName, locked.total_minor_units, locked.currency],
    )
    const payment = (await client.query<{ id: string; public_id: string }>('SELECT id, public_id FROM ticketug.payment WHERE order_id = $1 FOR UPDATE', [locked.id])).rows[0]

    const existing = (await client.query<PaymentRow>(
      `SELECT ${paymentSelect}, a.public_id AS attempt_public_id, a.status AS attempt_status, a.provider_attempt_reference
         FROM ticketug.payment p
         JOIN ticketug.order o ON o.id = p.order_id
         JOIN ticketug.payment_attempt a ON a.payment_id = p.id
        WHERE p.id = $1 AND a.idempotency_key = $2`,
      [payment.id, body.idempotencyKey],
    )).rows[0]
    if (existing) return present(existing)

    const inserted = await client.query(
      `INSERT INTO ticketug.payment_attempt (id, public_id, payment_id, provider, amount_minor_units, currency, idempotency_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
      [attemptId, attemptPublicId, payment.id, providerName, locked.total_minor_units, locked.currency, body.idempotencyKey],
    )
    if (inserted.rowCount !== 1) throw conflict('Duplicate payment initiation')

    const initiation = await provider.initiate({
      paymentPublicId: payment.public_id,
      attemptPublicId,
      amountMinorUnits: BigInt(locked.total_minor_units),
      currency: locked.currency,
      orderReference: locked.public_id,
      customer: { name: locked.purchaser_name, email: locked.purchaser_email, phone: locked.purchaser_phone },
    })

    await client.query(
      `UPDATE ticketug.payment_attempt SET provider_attempt_reference = $2, provider_metadata = $3, status = 'PROCESSING', processing_at = now() WHERE id = $1`,
      [attemptId, initiation.providerAttemptReference, JSON.stringify(initiation.metadata ?? {})],
    )
    await client.query(`UPDATE ticketug.payment SET status = 'PROCESSING', updated_at = now() WHERE id = $1`, [payment.id])
    await client.query(
      `UPDATE ticketug.order SET status = 'PAYMENT_PROCESSING', payment_state = 'PAYMENT_PROCESSING', payment_expires_at = $2, updated_at = now() WHERE id = $1`,
      [locked.id, paymentDeadline()],
    )

    return {
      paymentId: payment.public_id,
      attemptId: attemptPublicId,
      status: 'PROCESSING' as const,
      provider: providerName,
      providerAttemptReference: initiation.providerAttemptReference,
      redirectUrl: initiation.redirectUrl,
      instructions: initiation.instructions,
      amountMinorUnits: Number(locked.total_minor_units),
      currency: locked.currency,
    }
  })
}

export async function paymentStatus(actor: Actor, publicId: string) {
  await lazyExpire(publicId)
  const order = await loadOrder(actor, publicId)
  const result = await pool.query<PaymentRow>(
    `SELECT ${paymentSelect}, a.public_id AS attempt_public_id, a.status AS attempt_status, a.provider_attempt_reference, a.provider_metadata AS attempt_metadata
       FROM ticketug.payment p
       JOIN ticketug.order o ON o.id = p.order_id
       LEFT JOIN ticketug.payment_attempt a ON a.payment_id = p.id
      WHERE p.order_id = $1
      ORDER BY a.initiated_at DESC
      LIMIT 1`,
    [order.id],
  )
  if (!result.rows[0]) throw notFound('PAYMENT_NOT_FOUND')
  return present(result.rows[0])
}

// Staging-only simulated success. The production gate runs FIRST and is
// fail-closed (same expression the removed NestJS service enforced).
export async function simulateTestSuccess(actor: Actor, publicId: string) {
  if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE !== 'test') throw serviceUnavailable('TEST_PAYMENT_DISABLED')
  const order = await loadOrder(actor, publicId)
  return testCompleteForOrder(order.id)
}

async function testCompleteForOrder(orderId: string) {
  const result = await pool.query<{ provider_attempt_reference: string; amount_minor_units: string; currency: string; order_public_id: string }>(
    `SELECT a.provider_attempt_reference, a.amount_minor_units, a.currency, o.public_id AS order_public_id
       FROM ticketug.payment_attempt a
       JOIN ticketug.payment p ON p.id = a.payment_id
       JOIN ticketug.order o ON o.id = p.order_id
      WHERE a.payment_id = (SELECT id FROM ticketug.payment WHERE order_id = $1)
      ORDER BY a.initiated_at DESC
      LIMIT 1`,
    [orderId],
  )
  const attempt = result.rows[0]
  if (!attempt?.provider_attempt_reference) throw notFound('PAYMENT_ATTEMPT_NOT_FOUND')
  const event = {
    eventId: `test_evt_${randomUUID()}`,
    type: 'payment.succeeded',
    attemptReference: attempt.provider_attempt_reference,
    orderReference: attempt.order_public_id,
    amountMinorUnits: Number(attempt.amount_minor_units),
    currency: attempt.currency,
    status: 'SUCCEEDED',
  }
  const registry = new ProviderRegistry()
  const signed = registry.testWebhook(event)
  return applyVerifiedWebhook('test', signed.headers, event, signed.rawBody)
}

// The verified webhook's transactional core lives in ticketug.apply_payment_event
// (migration 012). The caller must have ALREADY verified the signature — this
// function never trusts unverified payloads.
export async function applyVerifiedWebhook(
  providerName: string,
  headers: Record<string, string | undefined>,
  body: unknown,
  rawBody: string,
): Promise<{ status: string }> {
  if (!rawBody) throw unprocessable('RAW_WEBHOOK_BODY_REQUIRED')
  const registry = new ProviderRegistry()
  const provider = registry.get(providerName)
  const event = provider.verifyWebhook({ headers, rawBody, body })
  // Some providers (NylonPay) carry only the attempt reference in their
  // payloads. Resolve the order reference server-side through the attempt —
  // the SQL core still re-checks it against the locked order, so the
  // amount/currency/order cross-checks are NOT weakened.
  let orderReference = event.orderReference
  if (!orderReference) {
    const resolved = await pool.query<{ order_public_id: string }>(
      `SELECT o.public_id AS order_public_id
         FROM ticketug.payment_attempt a
         JOIN ticketug.payment p ON p.id = a.payment_id
         JOIN ticketug.order o ON o.id = p.order_id
        WHERE p.provider = $1 AND a.provider_attempt_reference = $2
        LIMIT 1`,
      [providerName, event.providerAttemptReference],
    )
    orderReference = resolved.rows[0]?.order_public_id ?? ''
  }
  const result = await pool.query<{ result: { status: string } }>(
    `SELECT ticketug.apply_payment_event($1::text, $2::text, $3::text, $4::text, $5::text, $6::bigint, $7::text, $8::text, $9::jsonb) AS result`,
    [
      providerName,
      event.providerEventId,
      event.eventType,
      event.providerAttemptReference,
      orderReference,
      event.amountMinorUnits.toString(),
      event.currency,
      event.status,
      JSON.stringify(body ?? {}),
    ],
  )
  return result.rows[0].result
}
