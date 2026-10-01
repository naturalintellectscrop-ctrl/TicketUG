// Wire test: full NylonPay money chain against a locally started production
// server + the real Supabase DB + the real Nylon API (500 UGX prompt to a
// placeholder number — no money can move without a PIN; it times out).
// Webhook deliveries are self-generated with the REAL webhook secret, exactly
// as NylonPay would send them. All rows are marked wire-nylonpay-* and deleted.
import { Pool } from 'pg'
import { randomUUID, createHmac } from 'node:crypto'

const BASE = 'http://127.0.0.1:3100'
const WEBHOOK_SECRET = process.env.WIRE_WEBHOOK_SECRET
const DB_URL = process.env.WIRE_DB_URL
const MARK = 'wire-nylonpay'
if (!WEBHOOK_SECRET || !DB_URL) { console.error('WIRE_WEBHOOK_SECRET / WIRE_DB_URL required'); process.exit(1) }
const pool = new Pool({ connectionString: DB_URL, max: 3 })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }
const sign = (raw) => createHmac('sha256', WEBHOOK_SECRET).update(Buffer.from(raw, 'utf8')).digest('hex')

// --- 1. census guard + seed ---------------------------------------------------
const census = async () => {
  const tables = ['check_in', 'ticket', 'ticket_issuance_event', 'order_item', 'payment_attempt', 'payment', 'webhook_event', 'order', 'ticket_type', 'event_media', 'event', 'organizer_member', 'organizer', 'user_profile']
  const counts = await Promise.all(tables.map(async (t) => (await pool.query(`SELECT count(*)::int AS c FROM ticketug.${t}`)).rows[0].c))
  return tables.reduce((acc, t, i) => ({ ...acc, [t]: counts[i] }), {})
}
let before = await census()
console.log('census before:', JSON.stringify(before))
check('pre-test census has zero app rows', Object.values(before).every((c) => c === 0))

const profileId = randomUUID()
const organizerId = randomUUID()
const eventId = randomUUID()
const typeId = randomUUID()
const slug = `${MARK}-event`
await pool.query('INSERT INTO ticketug.user_profile (id, auth_user_id, display_name) VALUES ($1,$2,$3)', [profileId, `auth_${profileId}`, 'Wire Owner'])
await pool.query('INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES ($1,$2,$3,$4)', [organizerId, 'Wire Organizer', `${MARK}-org`, profileId])
await pool.query(`INSERT INTO ticketug.event (id, organizer_id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, created_by) VALUES ($1,$2,$3,$4,$5,'wire test',$6, now() + interval '30 days', now() + interval '31 days', 'PUBLIC', 'SALES_OPEN', true, $7)`, [eventId, organizerId, `pub_${slug}`, slug, 'Wire Test Event', 'Africa/Kampala', profileId])
await pool.query('INSERT INTO ticketug.ticket_type (id, event_id, public_id, name, price_minor_units, currency, capacity, remaining_capacity, active) VALUES ($1,$2,$3,$4,500,$5,5,5,true)', [typeId, eventId, `ttype_${MARK}`, 'Wire GA', 'UGX'])
console.log('seeded marked event/ticket')

// --- 2. guest order + live initiation ----------------------------------------
const idem = crypto.randomUUID()
const orderRes = await fetch(`${BASE}/api/orders/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ ticketTypeId: typeId, quantity: 2 }], purchaserName: 'Wire Buyer', purchaserEmail: `${MARK}@example.com`, purchaserPhone: '+256 700 000 000', idempotencyKey: idem }) })
const order = await orderRes.json()
check('guest order 201 with purchaser_phone', orderRes.status === 201 && !!order.publicId, JSON.stringify({ status: orderRes.status, total: order.totalMinorUnits }))
const guestHeaders = { 'content-type': 'application/json', 'x-order-access-token': order.guestAccessToken }

const initRes = await fetch(`${BASE}/api/orders/${order.publicId}/payment`, { method: 'POST', headers: guestHeaders, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) })
const initiation = await initRes.json()
check('payment initiation hits the REAL Nylon API (200 PROCESSING)', initRes.status === 200 && initiation.status === 'PROCESSING' && initiation.provider === 'nylonpay', JSON.stringify({ status: initRes.status, body: { provider: initiation.provider, status: initiation.status, ref: initiation.providerAttemptReference?.slice(0, 8), instructions: initiation.instructions?.slice(0, 60) } }))
check('providerAttemptReference is a UUID (Nylon reference contract)', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(initiation.providerAttemptReference ?? ''))
check('instructions surface the prompt copy', typeof initiation.instructions === 'string' && initiation.instructions.includes('+256700000000'))

const attemptRefRow = (await pool.query(`SELECT a.provider_attempt_reference, a.status, p.provider FROM ticketug.payment_attempt a JOIN ticketug.payment p ON p.id = a.payment_id WHERE a.public_id = $1`, [initiation.attemptId])).rows[0]
check('attempt row persisted with provider reference', attemptRefRow?.provider === 'nylonpay' && attemptRefRow.provider_attempt_reference === initiation.providerAttemptReference, JSON.stringify(attemptRefRow))

// status GET includes instructions
const statusRes = await fetch(`${BASE}/api/orders/${order.publicId}/payment`, { headers: guestHeaders })
const statusBody = await statusRes.json()
check('payment status exposes instructions for the UI', statusBody.instructions?.includes('mobile money prompt') === true)

// --- 3. webhook deliveries (validly signed, as NylonPay sends them) ----------
async function deliver(event, payloadOverrides = {}, signer = sign, rawOverride = null) {
  const body = { delivery_id: `dlv_${randomUUID()}`, event, timestamp: new Date().toISOString(), payload: { transactionId: 'wire-tx-1', reference: attemptRefRow.provider_attempt_reference, amount: '1000', currency: 'UGX', status: event.replace('transaction.', ''), previousStatus: 'processing', type: 'collection', method: 'mobileMoney', mode: 'live', failureReason: null, failureCategory: null, failureCode: null, operatorTid: null, ...payloadOverrides } }
  const raw = rawOverride ?? JSON.stringify(body)
  const res = await fetch(`${BASE}/api/public/payments/webhooks/nylonpay`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nylon-signature': signer(raw) }, body: raw })
  return { http: res.status, body: await res.json() }
}

const ignored = await deliver('transaction.processing')
check('PROCESSING webhook → 200 IGNORED (no state change)', ignored.http === 200 && ignored.body.status === 'IGNORED', JSON.stringify(ignored))
const dup = await deliver('transaction.processing')
check('replayed PROCESSING → 200 DUPLICATE (idempotent)', dup.http === 200 && dup.body.status === 'DUPLICATE')
const forged = await deliver('transaction.successful', {}, () => 'a'.repeat(64))
check('forged signature → 400 (fail-closed)', forged.http === 400, JSON.stringify(forged))
const wrongAmount = await deliver('transaction.successful', { amount: '999' })
check('amount mismatch → 422 INVALID_PAYMENT_AMOUNT', wrongAmount.http === 422, JSON.stringify(wrongAmount))
const unknownRef = await deliver('transaction.successful', { reference: randomUUID() })
check('unknown attempt reference → 404', unknownRef.http === 404, JSON.stringify(unknownRef))

const succeeded = await deliver('transaction.successful')
check('SUCCEEDED webhook → 200 PROCESSED (tickets issued)', succeeded.http === 200 && succeeded.body.status === 'PROCESSED', JSON.stringify(succeeded))
const replaySucceeded = await deliver('transaction.successful')
check('SUCCEEDED replay → 200 DUPLICATE (no double issuance)', replaySucceeded.http === 200 && replaySucceeded.body.status === 'DUPLICATE')

const orderStatusRow = (await pool.query(`SELECT status, payment_state FROM ticketug.order WHERE public_id = $1`, [order.publicId])).rows[0]
check('order transitions to PAID', orderStatusRow?.status === 'PAID' && orderStatusRow.payment_state === 'PAID', JSON.stringify(orderStatusRow))
const tickets = (await pool.query(`SELECT t.public_id, t.status FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id WHERE o.public_id = $1`, [order.publicId])).rows
check('exactly 2 tickets issued for the 2-item order', tickets.length === 2 && tickets.every((t) => t.status === 'ISSUED'), JSON.stringify(tickets.map((t) => t.public_id.slice(0, 8))))

// --- 4. cleanup + census -------------------------------------------------------
// Every DELETE is scoped to the wire-test markers (MARK-prefixed emails, the
// seeded event/organizer/profile ids). Nothing provider-wide: real webhook
// audit rows and real check-ins must survive the wire test.
await pool.query(`DELETE FROM ticketug.ticket WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%')`)
await pool.query(`DELETE FROM ticketug.ticket_issuance_event WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%')`)
await pool.query(`DELETE FROM ticketug.check_in WHERE ticket_id IN (SELECT t.id FROM ticketug.ticket t JOIN ticketug.order o ON o.id = t.order_id WHERE o.purchaser_email LIKE '${MARK}%')`)
await pool.query(`DELETE FROM ticketug.order_item WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%')`)
await pool.query(`DELETE FROM ticketug.webhook_event WHERE payload->'payload'->>'reference' IN (SELECT provider_attempt_reference::text FROM ticketug.payment_attempt WHERE payment_id IN (SELECT id FROM ticketug.payment WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%')))`)
await pool.query(`DELETE FROM ticketug.payment_attempt WHERE payment_id IN (SELECT id FROM ticketug.payment WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%'))`)
await pool.query(`DELETE FROM ticketug.payment WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%')`)
await pool.query(`DELETE FROM ticketug.order WHERE purchaser_email LIKE '${MARK}%'`)
await pool.query(`DELETE FROM ticketug.ticket_type WHERE event_id = $1`, [eventId])
await pool.query(`DELETE FROM ticketug.event WHERE id = $1`, [eventId])
await pool.query(`DELETE FROM ticketug.organizer WHERE id = $1`, [organizerId])
await pool.query(`DELETE FROM ticketug.user_profile WHERE id = $1`, [profileId])
let after = await census()
console.log('census after:', JSON.stringify(after))
check('post-test census restored to zero app rows', Object.values(after).every((c) => c === 0))

const failed = results.filter((r) => !r.ok)
console.log(`\nRESULT: ${results.length - failed.length} passed, ${failed.length} failed`)
await pool.end()
process.exit(failed.length ? 1 : 0)
