import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { pool } from '@/lib/db'
import { PAYMENT_WINDOW_MINUTES } from '@/lib/rules/order-rules'
import { notFound, unauthorized } from '@/lib/server/errors'

// Order domain — Supabase-native replacement for the removed NestJS
// OrdersService. Reads are owner/guest-scoped single statements; the atomic
// mutations (create/cancel/expire) live in ticketug SQL functions (migration
// 012) which re-verify authority internally. The lazy expiry hook runs before
// every status read/initiate exactly like the previous engine.

export const createOrderInput = z.object({
  items: z.array(z.object({
    ticketTypeId: z.string().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(20),
  purchaserName: z.string().trim().min(1).max(180),
  purchaserEmail: z.string().trim().email().max(320),
  idempotencyKey: z.string().min(1).max(128).optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderInput>
export type OrderProjection = {
  publicId: string; orderNumber: string; status: string; purchaserName: string; purchaserEmail: string
  currency: string; totalMinorUnits: number; createdAt: string; updatedAt: string
  cancelledAt: string | null; paymentExpiresAt: string | null
  items: Array<{ ticketTypeId: string; ticketName: string; quantity: number; unitPriceMinorUnits: number; currency: string; lineTotalMinorUnits: number }>
}

export function hashGuestToken(token: string) { return createHash('sha256').update(token).digest('hex') }

type SqlOrderResult = { reused: boolean; order: OrderProjection }

async function lazyExpire(publicId: string) {
  await pool.query('SELECT ticketug.expire_order_if_due($1::text) AS r', [publicId])
}

async function callCreateOrder(input: CreateOrderInput, actor: { profileId?: string; guestTokenHash?: string }): Promise<SqlOrderResult> {
  const result = await pool.query<{ result: SqlOrderResult }>(
    'SELECT ticketug.create_order($1::jsonb, $2::text, $3::text, $4::text, $5::uuid, $6::text, $7::int) AS result',
    [
      JSON.stringify(input.items),
      input.purchaserName,
      input.purchaserEmail.toLowerCase(),
      input.idempotencyKey ?? null,
      actor.profileId ?? null,
      actor.guestTokenHash ?? null,
      PAYMENT_WINDOW_MINUTES,
    ],
  )
  return result.rows[0].result
}

// Guest checkout: token minted here (Node CSPRNG), only the sha256 reaches SQL.
export async function createGuestOrder(input: CreateOrderInput): Promise<OrderProjection & { guestAccessToken: string }> {
  const guestToken = randomBytes(32).toString('base64url')
  const result = await callCreateOrder(input, { guestTokenHash: hashGuestToken(guestToken) })
  return { ...result.order, guestAccessToken: guestToken }
}

export async function createProfileOrder(profileId: string, input: CreateOrderInput): Promise<OrderProjection> {
  const result = await callCreateOrder(input, { profileId })
  return result.order
}

export async function listOrdersForProfile(profileId: string): Promise<OrderProjection[]> {
  const result = await pool.query<{ order: OrderProjection }>(
    'SELECT ticketug.order_json(o.id) AS "order" FROM ticketug.order o WHERE o.user_profile_id = $1 ORDER BY o.created_at DESC',
    [profileId],
  )
  return result.rows.map((row) => row.order)
}

export async function getOrderForProfile(profileId: string, publicId: string): Promise<OrderProjection> {
  const result = await pool.query<{ order: OrderProjection }>(
    'SELECT ticketug.order_json(o.id) AS "order" FROM ticketug.order o WHERE o.public_id = $1 AND o.user_profile_id = $2',
    [publicId, profileId],
  )
  if (!result.rows[0]) throw notFound('Order not found')
  return result.rows[0].order
}

export async function getOrderForGuest(publicId: string, token: string): Promise<OrderProjection> {
  await lazyExpire(publicId)
  const result = await pool.query<{ order: OrderProjection }>(
    'SELECT ticketug.order_json(o.id) AS "order" FROM ticketug.order o WHERE o.public_id = $1 AND o.user_profile_id IS NULL AND o.guest_access_token_hash = $2',
    [publicId, hashGuestToken(token)],
  )
  if (!result.rows[0]) throw notFound('Order not found')
  return result.rows[0].order
}

export async function cancelOrderForProfile(profileId: string, publicId: string): Promise<OrderProjection> {
  const result = await pool.query<{ result: SqlOrderResult }>(
    'SELECT ticketug.cancel_order($1::text, $2::uuid, NULL::text) AS result',
    [publicId, profileId],
  )
  return result.rows[0].result.order
}

export async function cancelOrderForGuest(publicId: string, token: string): Promise<OrderProjection> {
  await lazyExpire(publicId)
  const result = await pool.query<{ result: SqlOrderResult }>(
    'SELECT ticketug.cancel_order($1::text, NULL::uuid, $2::text) AS result',
    [publicId, hashGuestToken(token)],
  )
  return result.rows[0].result.order
}

// Access-key rotation ("single-use re-key"): the CURRENT valid token retires
// itself and a fresh one is issued; every previously shared link stops working.
export async function rekeyGuestOrder(publicId: string, token: string): Promise<{ publicId: string; orderNumber: string; guestAccessToken: string }> {
  const nextToken = randomBytes(32).toString('base64url')
  const result = await pool.query<{ public_id: string; order_number: string }>(
    `UPDATE ticketug.order o SET guest_access_token_hash = $3, updated_at = now()
      WHERE o.public_id = $1 AND o.user_profile_id IS NULL AND o.guest_access_token_hash = $2
      RETURNING o.public_id, o.order_number`,
    [publicId, hashGuestToken(token), hashGuestToken(nextToken)],
  )
  if (!result.rows[0]) throw notFound('Order not found')
  return { publicId: result.rows[0].public_id, orderNumber: result.rows[0].order_number, guestAccessToken: nextToken }
}

// Operator/cron sweep — POST /api/system/orders/expire-stale (x-cron-secret).
export async function expireStaleOrders(limit?: number): Promise<{ expiredCount: number; windowMinutes: number; orders: Array<{ publicId: string; orderNumber: string; status: string; inventoryRestored: number }> }> {
  const capped = Math.min(500, Math.max(1, Math.floor(limit ?? 100) || 100))
  const result = await pool.query<{ result: SqlOrderResult['order'][] | null }>(
    'SELECT ticketug.expire_stale_orders($1::int) AS result',
    [capped],
  )
  const orders = (result.rows[0]?.result ?? []) as unknown as Array<{ publicId: string; orderNumber: string; status: string; inventoryRestored: number }>
  return { expiredCount: orders.length, windowMinutes: PAYMENT_WINDOW_MINUTES, orders }
}

// Input-shape guard for guest header surfaces (kept explicit so a missing
// header never reaches SQL as an empty-string credential).
export function requireGuestToken(token: string | null | undefined): string {
  if (!token) throw unauthorized('Guest access token required')
  return token
}
