// Pair 6 Phase I — SQL-function verification against the REAL Supabase DB.
// Creates only clearly-marked verification records (slug 'p6-verify-*') and
// removes exactly those records afterwards. Read-only for everything else.
import fs from 'node:fs'
import pg from 'pg'

const envText = fs.readFileSync('/home/z/TicketUG/.env', 'utf8')
const env = Object.fromEntries(envText.split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const ca = fs.readFileSync('/home/z/TicketUG/certs/supabase-root-2021-ca.pem', 'utf8')
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { ca, rejectUnauthorized: true }, max: 8 })

let passed = 0, failed = 0
const check = (name: string, ok: boolean, detail = '') => { if (ok) { passed++; console.log(`  OK ${name}`) } else { failed++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`) } }
const MARK = 'p6-verify'

async function cleanup(q: (t: string, v?: unknown[]) => Promise<pg.QueryResult<any>>) {
  // Rerun-safe: remove ONLY this script's marked verification records.
  await q("DELETE FROM ticketug.check_in WHERE ticket_id IN (SELECT t.id FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE o.purchaser_email LIKE $1)", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.ticket WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE $1)", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.ticket_issuance_event WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE $1)", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.webhook_event WHERE provider_reference LIKE 'verify-p6-%'")
  await q("DELETE FROM ticketug.payment_attempt WHERE payment_id IN (SELECT id FROM ticketug.payment WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE $1))", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.payment WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE $1)", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.order_item WHERE order_id IN (SELECT id FROM ticketug.order WHERE purchaser_email LIKE $1)", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.order WHERE purchaser_email LIKE $1", [`${MARK}%@example.com`])
  await q("DELETE FROM ticketug.ticket_type WHERE public_id LIKE $1", [`tt_${MARK}%`])
  await q("DELETE FROM ticketug.event WHERE slug LIKE $1", [`${MARK}%`])
  await q("DELETE FROM ticketug.organizer WHERE slug LIKE $1", [`${MARK}%`])
  await q("DELETE FROM ticketug.user_profile WHERE auth_user_id LIKE $1", [`auth_${MARK}%`])
}

async function main() {
  const q = (text: string, values: unknown[] = []): Promise<pg.QueryResult<any>> => pool.query(text, values)
  console.log('=== Pre-clean (rerun-safe) + Setup (marked verification data) ===')
  await cleanup(q)
  const owner = (await q("INSERT INTO ticketug.user_profile (id, auth_user_id, display_name) VALUES (gen_random_uuid(), $1, 'P6 Owner') RETURNING id", [`auth_${MARK}-owner`])).rows[0].id
  const outsider = (await q("INSERT INTO ticketug.user_profile (id, auth_user_id, display_name) VALUES (gen_random_uuid(), $1, 'P6 Outsider') RETURNING id", [`auth_${MARK}-outsider`])).rows[0].id
  const organizer = (await q('INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id', ['P6 Verify Collective', `${MARK}-collective`, owner])).rows[0].id
  await q("INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status) VALUES (gen_random_uuid(), $1, $2, 'ORGANIZER_OWNER', 'ACTIVE')", [organizer, owner])
  const evt = (await q(`INSERT INTO ticketug.event (id, organizer_id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, created_by) VALUES (gen_random_uuid(), $1, $2, $3, 'P6 Verify Event', 'verify', 'Africa/Kampala', now() + interval '10 days', now() + interval '11 days', 'PUBLIC', 'SALES_OPEN', true, $4) RETURNING id`, [organizer, `pub_${MARK}`, `${MARK}-event`, owner])).rows[0].id
  const tt = (await q(`INSERT INTO ticketug.ticket_type (id, event_id, public_id, name, price_minor_units, currency, capacity, remaining_capacity, active) VALUES (gen_random_uuid(), $1, $2, 'P6 Regular', 10000, 'UGX', 5, 5, true) RETURNING id`, [evt, `tt_${MARK}`])).rows[0].id
  const ttInactive = (await q(`INSERT INTO ticketug.ticket_type (id, event_id, public_id, name, price_minor_units, currency, capacity, remaining_capacity, active) VALUES (gen_random_uuid(), $1, $2, 'P6 Inactive', 10000, 'UGX', 5, 5, false) RETURNING id`, [evt, `tt_${MARK}-i`])).rows[0].id

  console.log('=== create_order ===')
  // 1. valid guest order
  const guestHash = 'aaaa' // deterministic marker hash (verification only)
  const r1 = (await q('SELECT ticketug.create_order($1::jsonb,$2,$3,$4,NULL::uuid,$5::text,15) AS r', [JSON.stringify([{ ticketTypeId: tt, quantity: 2 }]), 'P6 Guest', `${MARK}@example.com`, 'idem-p6-1', guestHash])).rows[0].r
  check('guest order created', r1.reused === false && r1.order.totalMinorUnits === 20000 && r1.order.items.length === 1, JSON.stringify(r1).slice(0, 120))
  const cap1 = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [tt])).rows[0].remaining_capacity
  check('inventory decremented 5→3', cap1 === 3, `got ${cap1}`)
  // 2. guest idempotency conflict
  let conflict = false
  try { await q('SELECT ticketug.create_order($1::jsonb,$2,$3,$4,NULL::uuid,$5::text,15)', [JSON.stringify([{ ticketTypeId: tt, quantity: 1 }]), 'P6 Guest', `${MARK}@example.com`, 'idem-p6-1', 'bbbb']) } catch (err) { const e = err as Error; conflict = /Guest idempotency key was already used/.test(e.message) }
  check('guest idempotency key reuse rejected (409 semantics)', conflict)
  // 3. insufficient inventory
  let insuff = false
  try { await q('SELECT ticketug.create_order($1::jsonb,$2,$3,$4,NULL::uuid,$5::text,15)', [JSON.stringify([{ ticketTypeId: tt, quantity: 4 }]), 'P6 G2', `${MARK}2@example.com`, null, 'cccc']) } catch (err) { const e = err as Error; insuff = e.message === 'Insufficient ticket inventory' }
  check('insufficient inventory rejected', insuff)
  // 4. inactive type
  let inactive = false
  try { await q('SELECT ticketug.create_order($1::jsonb,$2,$3,NULL,NULL::uuid,$4::text,15)', [JSON.stringify([{ ticketTypeId: ttInactive, quantity: 1 }]), 'P6 G3', `${MARK}3@example.com`, 'dddd']) } catch (err) { const e = err as Error; inactive = e.message === 'Ticket type is inactive' }
  check('inactive ticket type rejected', inactive)
  // 5. duplicate type in one order
  let dup = false
  try { await q('SELECT ticketug.create_order($1::jsonb,$2,$3,NULL,NULL::uuid,$4::text,15)', [JSON.stringify([{ ticketTypeId: tt, quantity: 1 }, { ticketTypeId: tt, quantity: 1 }]), 'P6 G4', `${MARK}4@example.com`, 'eeee']) } catch (err) { const e = err as Error; dup = e.message === 'Each ticket type may appear once per order' }
  check('duplicate ticket type rejected', dup)
  // 6. user order + idempotent reuse
  const r6 = (await q('SELECT ticketug.create_order($1::jsonb,$2,$3,$4,$5::uuid,NULL::text,15) AS r', [JSON.stringify([{ ticketTypeId: tt, quantity: 1 }]), 'P6 User', `${MARK}5@example.com`, 'idem-p6-2', owner])).rows[0].r
  check('user order created', r6.reused === false && r6.order.status === 'AWAITING_PAYMENT')
  const r6b = (await q('SELECT ticketug.create_order($1::jsonb,$2,$3,$4,$5::uuid,NULL::text,15) AS r', [JSON.stringify([{ ticketTypeId: tt, quantity: 1 }]), 'P6 User', `${MARK}5@example.com`, 'idem-p6-2', owner])).rows[0].r
  check('user idempotent replay reuses the order', r6b.reused === true && r6b.order.publicId === r6.order.publicId)

  console.log('=== create_order CONCURRENCY (oversell barrier) ===')
  // Capacity is now 5-2-1 = 2. Six concurrent requests for 2 each → exactly one wins.
  const capNow = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [tt])).rows[0].remaining_capacity
  const attempts = await Promise.allSettled(Array.from({ length: 6 }, (_, i) =>
    q('SELECT ticketug.create_order($1::jsonb,$2,$3,NULL,NULL::uuid,$4::text,15) AS r', [JSON.stringify([{ ticketTypeId: tt, quantity: 2 }]), `P6 Race ${i}`, `${MARK}race${i}@example.com`, `racehash-${MARK}-${i}`])))
  attempts.forEach((a, i) => { if (a.status === 'rejected') console.log(`    race[${i}] rejected: ${String(a.reason?.message ?? a.reason).slice(0, 160)}`) })
  const winners = attempts.filter((a) => a.status === 'fulfilled').length
  const losersInsuff = attempts.filter((a) => a.status === 'rejected' && a.reason?.message === 'Insufficient ticket inventory').length
  const capAfter = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [tt])).rows[0].remaining_capacity
  check(`exactly ${capNow / 2} of 6 concurrent 2-unit orders won`, winners === capNow / 2 && losersInsuff === 6 - winners, `won ${winners}, lost ${losersInsuff}`)
  check('no oversell (capacity 0, never negative)', capAfter === 0, `got ${capAfter}`)

  console.log('=== cancel_order ===')
  const guestOrderPublic = r1.order.publicId
  let wrongToken = false
  try { await q('SELECT ticketug.cancel_order($1,NULL::uuid,$2::text)', [guestOrderPublic, 'wrong-hash']) } catch (err) { const e = err as Error; wrongToken = e.message === 'Order not found' }
  check('wrong guest token cannot cancel', wrongToken)
  const rc = (await q('SELECT ticketug.cancel_order($1,NULL::uuid,$2::text) AS r', [guestOrderPublic, guestHash])).rows[0].r
  const capRestored = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [tt])).rows[0].remaining_capacity
  check('guest cancel restores inventory (0→2)', rc.order.status === 'CANCELLED' && capRestored === 2, `status ${rc.order.status}, cap ${capRestored}`)
  let recancel = false
  try { await q('SELECT ticketug.cancel_order($1,NULL::uuid,$2::text)', [guestOrderPublic, guestHash]) } catch (err) { const e = err as Error; recancel = /ORDER_STATE_TRANSITION_INVALID/.test(e.message) }
  check('double cancel rejected (state machine)', recancel)

  console.log('=== expire_order_if_due + expire_stale_orders ===')
  const ttExp = (await q(`INSERT INTO ticketug.ticket_type (id, event_id, public_id, name, price_minor_units, currency, capacity, remaining_capacity, active) VALUES (gen_random_uuid(), $1, $2, 'P6 ExpType', 10000, 'UGX', 5, 5, true) RETURNING id`, [evt, `tt_${MARK}-exp`])).rows[0].id
  await q('SELECT ticketug.create_order($1::jsonb,$2,$3,NULL,NULL::uuid,$4::text,15)', [JSON.stringify([{ ticketTypeId: ttExp, quantity: 2 }]), 'P6 ExpBuyer', `${MARK}expbuy@example.com`, `expbuyhash-${MARK}`])
  const expOrder = (await q(`INSERT INTO ticketug.order (id, public_id, order_number, purchaser_name, purchaser_email, guest_access_token_hash, status, payment_state, currency, total_minor_units, payment_expires_at) VALUES (gen_random_uuid(), $1, $2, 'P6 Exp', $3, $4, 'AWAITING_PAYMENT', 'AWAITING_PAYMENT', 'UGX', 10000, now() - interval '1 minute') RETURNING id, public_id`, [`ord_${MARK}-exp`, `UG-EXP-${MARK}`, `${MARK}exp@example.com`, 'expired-marker-hash'])).rows[0]
  await q('INSERT INTO ticketug.order_item (id, order_id, ticket_type_id, quantity, ticket_name_snapshot, unit_price_minor_units, currency_snapshot, line_total_minor_units) VALUES (gen_random_uuid(), $1, $2, 2, $3, 10000, $4, 20000)', [expOrder.id, ttExp, 'P6 ExpType', 'UGX'])
  const beforeExp = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [ttExp])).rows[0].remaining_capacity
  const re1 = (await q('SELECT ticketug.expire_order_if_due($1::text) AS r', [expOrder.public_id])).rows[0].r
  const afterExp = (await q('SELECT remaining_capacity FROM ticketug.ticket_type WHERE id=$1', [ttExp])).rows[0].remaining_capacity
  check('due order expired with inventory restored (+2)', re1?.status === 'EXPIRED' && afterExp === beforeExp + 2 && re1.inventoryRestored === 2, `restored ${re1?.inventoryRestored}, cap ${beforeExp}→${afterExp}`)
  const re2 = (await q('SELECT ticketug.expire_order_if_due($1::text) AS r', [expOrder.public_id])).rows[0].r
  check('second expiry call is a no-op', re2 === null)

  console.log('=== apply_payment_event (issuance path) ===')
  const payOrder = (await q(`INSERT INTO ticketug.order (id, public_id, order_number, purchaser_name, purchaser_email, guest_access_token_hash, status, payment_state, currency, total_minor_units, payment_expires_at) VALUES (gen_random_uuid(), $1, $2, 'P6 Pay', $3, $4, 'AWAITING_PAYMENT', 'AWAITING_PAYMENT', 'UGX', 30000, now() + interval '15 minutes') RETURNING id, public_id`, [`ord_${MARK}-pay`, `UG-PAY-${MARK}`, `${MARK}pay@example.com`, 'pay-marker-hash'])).rows[0].id
  await q('INSERT INTO ticketug.order_item (id, order_id, ticket_type_id, quantity, ticket_name_snapshot, unit_price_minor_units, currency_snapshot, line_total_minor_units) VALUES (gen_random_uuid(), $1, $2, 3, $3, 10000, $4, 30000)', [payOrder, tt, 'P6 Regular', 'UGX'])
  const payment = (await q(`INSERT INTO ticketug.payment (id, public_id, order_id, provider, amount_minor_units, currency) VALUES (gen_random_uuid(), $1, $2, 'test', 30000, 'UGX') RETURNING id`, [`pay_${MARK}`, payOrder])).rows[0].id
  const attemptRef = `verify-p6-${Date.now()}`
  await q(`INSERT INTO ticketug.payment_attempt (id, public_id, payment_id, provider, amount_minor_units, currency, idempotency_key, status, provider_attempt_reference) VALUES (gen_random_uuid(), $1, $2, 'test', 30000, 'UGX', $3, 'PROCESSING', $4)`, [`pat_${MARK}`, payment, `idem-${attemptRef}`, attemptRef])
  const apply1 = (await q('SELECT ticketug.apply_payment_event($1,$2,$3,$4,$5,$6::bigint,$7,$8,$9::jsonb) AS r', ['test', `evt_${MARK}-1`, 'payment.succeeded', attemptRef, `ord_${MARK}-pay`, 30000, 'UGX', 'SUCCEEDED', '{}'])).rows[0].r
  const ticketsIssued = (await q('SELECT count(*)::int AS n FROM ticketug.ticket WHERE order_id=$1', [payOrder])).rows[0].n
  check('webhook applied → order PAID + 3 tickets issued', apply1.status === 'PROCESSED' && ticketsIssued === 3, `${apply1.status}, ${ticketsIssued} tickets`)
  const ordState = (await q('SELECT status, payment_state FROM ticketug.order WHERE id=$1', [payOrder])).rows[0]
  check('order transitioned to PAID/PAID', ordState.status === 'PAID' && ordState.payment_state === 'PAID')
  // replays
  const apply2 = (await q('SELECT ticketug.apply_payment_event($1,$2,$3,$4,$5,$6::bigint,$7,$8,$9::jsonb) AS r', ['test', `evt_${MARK}-1`, 'payment.succeeded', attemptRef, `ord_${MARK}-pay`, 30000, 'UGX', 'SUCCEEDED', '{}'])).rows[0].r
  const apply3 = (await q('SELECT ticketug.apply_payment_event($1,$2,$3,$4,$5,$6::bigint,$7,$8,$9::jsonb) AS r', ['test', `evt_${MARK}-2`, 'payment.succeeded', attemptRef, `ord_${MARK}-pay`, 30000, 'UGX', 'SUCCEEDED', '{}'])).rows[0].r
  const ticketsAfterReplays = (await q('SELECT count(*)::int AS n FROM ticketug.ticket WHERE order_id=$1', [payOrder])).rows[0].n
  check('same-event replay → DUPLICATE', apply2.status === 'DUPLICATE')
  check('new event on SUCCEEDED attempt → DUPLICATE', apply3.status === 'DUPLICATE')
  check('no duplicate tickets after replays', ticketsAfterReplays === 3)
  // wrong amount
  let badAmount = false
  try { await q('SELECT ticketug.apply_payment_event($1,$2,$3,$4,$5,$6::bigint,$7,$8,$9::jsonb)', ['test', `evt_${MARK}-3`, 'payment.succeeded', attemptRef, `ord_${MARK}-pay`, 999, 'UGX', 'SUCCEEDED', '{}']) } catch (err) { const e = err as Error; badAmount = e.message === 'INVALID_PAYMENT_AMOUNT' }
  check('wrong amount rejected (422 semantics)', badAmount)
  // wrong order reference
  let badOrder = false
  try { await q('SELECT ticketug.apply_payment_event($1,$2,$3,$4,$5,$6::bigint,$7,$8,$9::jsonb)', ['test', `evt_${MARK}-4`, 'payment.succeeded', attemptRef, 'ord_unknown', 30000, 'UGX', 'SUCCEEDED', '{}']) } catch (err) { const e = err as Error; badOrder = e.message === 'INVALID_PAYMENT_ORDER' }
  check('wrong order reference rejected', badOrder)

  console.log('=== transition_event_lifecycle ===')
  let outsiderDenied = false
  try { await q('SELECT ticketug.transition_event_lifecycle($1::uuid,$2::uuid,$3::text)', [outsider, evt, 'SALES_CLOSED']) } catch (err) { const e = err as Error; outsiderDenied = e.message === 'Organizer access denied' }
  check('non-member cannot transition', outsiderDenied)
  const t1 = (await q('SELECT ticketug.transition_event_lifecycle($1::uuid,$2::uuid,$3::text) AS r', [owner, evt, 'SALES_CLOSED'])).rows[0].r
  check('owner transitions SALES_OPEN→SALES_CLOSED', t1.lifecycle_state === 'SALES_CLOSED')
  let invalid = false
  try { await q('SELECT ticketug.transition_event_lifecycle($1::uuid,$2::uuid,$3::text)', [owner, evt, 'COMPLETED']) } catch (err) { const e = err as Error; invalid = (e as Error).message === 'Invalid event lifecycle transition' }
  check('SALES_CLOSED→COMPLETED (illegal jump) rejected', invalid)
  const t2 = (await q('SELECT ticketug.transition_event_lifecycle($1::uuid,$2::uuid,$3::text) AS r', [owner, evt, 'EVENT_LIVE'])).rows[0].r
  check('SALES_CLOSED→EVENT_LIVE valid', t2.lifecycle_state === 'EVENT_LIVE')
  const t3 = (await q('SELECT ticketug.transition_event_lifecycle($1::uuid,$2::uuid,$3::text) AS r', [owner, evt, 'COMPLETED'])).rows[0].r
  check('EVENT_LIVE→COMPLETED valid', t3.lifecycle_state === 'COMPLETED')

  console.log('=== Cleanup (verification records only) ===')
  await cleanup(q)
  const leftovers = (await q("SELECT count(*)::int AS n FROM ticketug.order WHERE purchaser_email LIKE $1", [`${MARK}%@example.com`])).rows[0].n
  check('cleanup left no verification records', leftovers === 0)

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  await pool.end()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error('VERIFY FAIL:', e); try { await pool.end() } catch {} ; process.exit(1) })
