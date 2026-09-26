import { NextRequest } from 'next/server'
import { z } from 'zod'
import { pool } from '@/lib/db'
import { randomBytes, randomUUID, createHash } from 'node:crypto'

// Payment window for the inventory reservation. Keep in sync with the
// canonical definition in apps/api/src/orders/order.rules.ts
// (PAYMENT_WINDOW_MINUTES, clamped 1..120, default 15).
const PAYMENT_WINDOW_MINUTES = Math.min(120, Math.max(1, Number(process.env.PAYMENT_WINDOW_MINUTES ?? 15) || 15))

const payload = z.object({ items: z.array(z.object({ ticketTypeId: z.string().min(1), quantity: z.number().int().positive().max(100) })).min(1).superRefine((items, context) => { const ids = new Set<string>(); for (const item of items) { if (ids.has(item.ticketTypeId)) context.addIssue({ code: 'custom', message: 'Each ticket type may appear once per order' }); ids.add(item.ticketTypeId) } }), purchaserName: z.string().trim().min(1).max(180), purchaserEmail: z.string().email().max(320), idempotencyKey: z.string().max(128).optional() })

export async function POST(request: NextRequest) {
  const parsed = payload.safeParse(await request.json())
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 })
  const { items, purchaserName, purchaserEmail, idempotencyKey } = parsed.data
  if (idempotencyKey) {
    const existing = await pool.query('SELECT public_id, order_number, status, total_minor_units, currency FROM ticketug.order WHERE user_profile_id IS NULL AND purchaser_email=$1 AND idempotency_key=$2', [purchaserEmail.toLowerCase(), idempotencyKey])
    if (existing.rows[0]) return Response.json({ message: 'Guest idempotency key was already used; use the original access token' }, { status: 409 })
  }
  const sorted = [...items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const locked: Array<Record<string, any>> = []
    for (const item of sorted) {
      const result = await client.query('SELECT t.*, e.lifecycle_state, e.publication_state FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE t.public_id=$1 FOR UPDATE OF t', [item.ticketTypeId])
      if (!result.rows[0]) throw new Error('Ticket type not found')
      locked.push(result.rows[0])
    }
    const lines = items.map((item) => {
      const ticket = locked.find((row) => row.public_id === item.ticketTypeId)
      if (!ticket) throw new Error('Ticket type not found')
      if (!ticket.active || ticket.lifecycle_state !== 'SALES_OPEN' || ticket.publication_state !== 'PUBLIC') throw new Error('Event is not accepting orders')
      if (ticket.sale_starts_at && Date.now() < Date.parse(ticket.sale_starts_at)) throw new Error('Ticket sales have not started')
      if (ticket.sale_ends_at && Date.now() >= Date.parse(ticket.sale_ends_at)) throw new Error('Ticket sales have ended')
      if (ticket.remaining_capacity < item.quantity) throw new Error('Insufficient ticket inventory')
      const line = BigInt(ticket.price_minor_units) * BigInt(item.quantity)
      return { item, ticket, line }
    })
    const total = lines.reduce((sum, line) => sum + line.line, BigInt(0))
    const token = randomBytes(32).toString('base64url')
    const orderId = randomUUID()
    const order = await client.query('INSERT INTO ticketug.order (id,public_id,order_number,purchaser_name,purchaser_email,guest_access_token_hash,total_minor_units,idempotency_key,payment_expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING public_id,order_number,status,total_minor_units,currency,payment_expires_at', [orderId, `ord_${randomBytes(12).toString('hex')}`, `UG-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`, purchaserName, purchaserEmail.toLowerCase(), createHash('sha256').update(token).digest('hex'), total.toString(), idempotencyKey ?? null, new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000)])
    for (const line of lines) {
      const updated = await client.query('UPDATE ticketug.ticket_type SET remaining_capacity=remaining_capacity-$2 WHERE id=$1 AND remaining_capacity >= $2', [line.ticket.id, line.item.quantity])
      if (updated.rowCount !== 1) throw new Error('Insufficient ticket inventory')
      await client.query('INSERT INTO ticketug.order_item (id,order_id,ticket_type_id,quantity,ticket_name_snapshot,unit_price_minor_units,currency_snapshot,line_total_minor_units) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), orderId, line.ticket.id, line.item.quantity, line.ticket.name, line.ticket.price_minor_units, line.ticket.currency, line.line.toString()])
    }
    await client.query('COMMIT')
    return Response.json({ ...order.rows[0], guestAccessToken: token }, { status: 201 })
  } catch (error) { await client.query('ROLLBACK'); return Response.json({ message: error instanceof Error ? error.message : 'Unable to create order' }, { status: 409 }) } finally { client.release() }
}
