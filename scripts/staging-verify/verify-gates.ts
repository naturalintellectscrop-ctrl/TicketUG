// ============================================================================
// THROWAWAY-DB VERIFICATION RUNNER — Pair 2 Feature 2.
// Never points at production: refuses non-local databases unless --allow-remote
// is passed explicitly. See scripts/staging-verify/README.md.
//
// What it proves, against a REAL Postgres engine:
//   A. migration 011 objects exist (tables, columns, indexes, constraints)
//   B. seed: organizer/event/gates (Main/VIP/VVIP)/ticket types/staff/attendee
//   C. REAL ticket issuance through TicketsService.issuePaidOrder
//   D. REAL scanner decisions through CheckInsService.scan (server-authoritative;
//      the gate comes from the staff assignment row, never the client)
//   E. gate deletion CASCADEs fail-closed (permissions + assignments removed)
//   F. REAL DB-backed PDF generation through TicketsService.pdfMine/pdfGuest
// ============================================================================

import { Pool, type PoolClient } from 'pg'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { TicketsService } from '../../apps/api/src/tickets/tickets.service'
import { CheckInsService } from '../../apps/api/src/check-ins/check-ins.service'
import type { ApiUser } from '../../apps/api/src/auth/auth.types'

const args = process.argv.slice(2)
const urlArg = args.find((arg) => arg.startsWith('--url='))
const allowRemote = args.includes('--allow-remote')
const url = urlArg?.slice('--url='.length) ?? process.env.STAGING_VERIFY_URL ?? ''
if (!url) { console.error('Usage: bun scripts/staging-verify/verify-gates.ts --url=postgres://user:pass@host:port/throwaway-db'); process.exit(2) }
const host = new URL(url).hostname
if (!allowRemote && !['localhost', '127.0.0.1', '::1'].includes(host)) { console.error(`Refusing non-local database host "${host}" without --allow-remote (this runner seeds and deletes data).`); process.exit(2) }

class DbShim {
  constructor(readonly pool: Pool) {}
  query(text: string, values: unknown[] = []) { return this.pool.query(text, values) }
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
  }
}

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail = '') {
  if (condition) { passed++; console.log(`  ✓ ${name}`) } else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
async function expectOutcome(name: string, promise: Promise<{ outcome: string; permittedGates?: string[] }>, expected: string, extra?: (result: { outcome: string; permittedGates?: string[] }) => boolean) {
  try {
    const result = await promise
    check(`${name} → ${expected}`, result.outcome === expected && (extra ? extra(result) : true), `got ${result.outcome}${result.permittedGates ? ` (permitted: ${result.permittedGates.join(', ')})` : ''}`)
  } catch (error) {
    check(`${name} → ${expected}`, false, `threw ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const pool = new Pool({ connectionString: url, max: 5 })
  const db = new DbShim(pool)
  // Rerun-safe: wipe throwaway data from any previous run of this harness.
  const tables = ['check_in', 'ticket', 'ticket_issuance_event', 'ticket_type_gate', 'event_gate', 'event_staff_assignment', 'order_item', 'payment_attempt', 'payment', 'webhook_event', 'order', 'ticket_type', 'event_media', 'event', 'venue', 'organizer_member', 'organizer', 'user_profile']
  await pool.query(`TRUNCATE ${tables.map((table) => `ticketug.${table}`).join(', ')} CASCADE`)
  const ticketsService = new TicketsService(db as never)
  const checkInsService = new CheckInsService(db as never)

  console.log('\nA. Migration 011 object verification')
  const tableExists = async (table: string) => (await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='ticketug' AND table_name=$1`, [table])).rowCount === 1
  check('ticketug.event_gate exists', await tableExists('event_gate'))
  check('ticketug.ticket_type_gate exists', await tableExists('ticket_type_gate'))
  const gateColumn = await pool.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='ticketug' AND table_name='event_staff_assignment' AND column_name='gate_id'`)
  check('event_staff_assignment.gate_id (uuid, nullable) exists', gateColumn.rows[0]?.data_type === 'uuid')
  const indexes = await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname='ticketug' AND indexname IN ('event_gate_event_name_unique','event_gate_event_active_idx','ticket_type_gate_pkey','ticket_type_gate_gate_idx','event_staff_assignment_gate_idx')`)
  check('all five 011 indexes present', indexes.rowCount === 5, `found ${indexes.rowCount}`)
  const cascade = await pool.query(`SELECT confdeltype FROM pg_constraint WHERE conname LIKE 'ticket_type_gate_gate_id%' OR (conrelid = 'ticketug.ticket_type_gate'::regclass AND confrelid = 'ticketug.event_gate'::regclass)`)
  check('ticket_type_gate → gate is ON DELETE CASCADE (fail-closed)', cascade.rows.some((row) => row.confdeltype === 'c'))
  const assignmentCascade = await pool.query(`SELECT confdeltype FROM pg_constraint WHERE conrelid = 'ticketug.event_staff_assignment'::regclass AND confrelid = 'ticketug.event_gate'::regclass`)
  check('assignment.gate_id → gate is ON DELETE CASCADE (never widened)', assignmentCascade.rows.some((row) => row.confdeltype === 'c'))

  console.log('\nB. Seed (throwaway data)')
  const ownerProfile = randomUUID(); const staffMainProfile = randomUUID(); const staffVipProfile = randomUUID(); const staffVvipProfile = randomUUID(); const staffEventwideProfile = randomUUID(); const staffDisabledProfile = randomUUID(); const outsiderProfile = randomUUID(); const buyerProfile = randomUUID()
  for (const [id, name] of [[ownerProfile, 'Owner'], [staffMainProfile, 'Staff Main'], [staffVipProfile, 'Staff VIP'], [staffVvipProfile, 'Staff VVIP'], [staffEventwideProfile, 'Staff Eventwide'], [staffDisabledProfile, 'Staff Disabled'], [outsiderProfile, 'Outsider'], [buyerProfile, 'Buyer']] as const) await pool.query('INSERT INTO ticketug.user_profile (id, auth_user_id, display_name) VALUES ($1,$2,$3)', [id, `auth_${id}`, name])
  const organizerId = randomUUID()
  await pool.query('INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES ($1,$2,$3,$4)', [organizerId, 'Night Shift Collective', 'night-shift-verify', ownerProfile])
  for (const [profileId, role] of [[ownerProfile, 'ORGANIZER_OWNER'], [staffMainProfile, 'EVENT_STAFF'], [staffVipProfile, 'EVENT_STAFF'], [staffVvipProfile, 'EVENT_STAFF'], [staffEventwideProfile, 'EVENT_STAFF'], [staffDisabledProfile, 'EVENT_STAFF']] as const) await pool.query('INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), organizerId, profileId, role, 'ACTIVE'])
  const makeEvent = async (title: string, lifecycle: string, slug: string) => {
    const id = randomUUID()
    await pool.query(`INSERT INTO ticketug.event (id, organizer_id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, created_by) VALUES ($1,$2,$3,$4,$5,'verify',$6, now() + interval '30 days', now() + interval '31 days', 'PUBLIC', $7, true, $8)`, [id, organizerId, `pub_${slug}`, slug, title, 'Africa/Kampala', lifecycle, ownerProfile])
    return id
  }
  const evt1 = await makeEvent('Verify Gate Night', 'SALES_OPEN', 'verify-gate-night')
  const evt2 = await makeEvent('Verify Other Night', 'SALES_OPEN', 'verify-other-night')
  const evt3 = await makeEvent('Verify Cancelled Night', 'CANCELLED', 'verify-cancelled-night')
  const evt4 = await makeEvent('Verify Suspended Night', 'SUSPENDED', 'verify-suspended-night')
  const makeVenueAndType = async (eventId: string, name: string, price: number) => {
    const id = randomUUID()
    await pool.query('INSERT INTO ticketug.ticket_type (id, event_id, public_id, name, price_minor_units, currency, capacity, remaining_capacity, active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)', [id, eventId, `ttype_${name}_${eventId.slice(0, 6)}`, name, price, 'UGX', 100, 100])
    return { id, name, price }
  }
  const typeRegular = await makeVenueAndType(evt1, 'Regular', 20000)
  const typeVip = await makeVenueAndType(evt1, 'VIP', 60000)
  const typeVvip = await makeVenueAndType(evt1, 'VVIP', 150000)
  const typeUnmapped = await makeVenueAndType(evt1, 'Backstage', 90000)
  const typeEvt2 = await makeVenueAndType(evt2, 'Regular', 10000)
  const typeEvt3 = await makeVenueAndType(evt3, 'Regular', 10000)
  const typeEvt4 = await makeVenueAndType(evt4, 'Regular', 10000)

  const makeGate = async (eventId: string, name: string, active: boolean) => { const id = randomUUID(); await pool.query('INSERT INTO ticketug.event_gate (id, event_id, name, is_active) VALUES ($1,$2,$3,$4)', [id, eventId, name, active]); return id }
  const mainGate = await makeGate(evt1, 'Main Gate', true)
  const vipGate = await makeGate(evt1, 'VIP Gate', true)
  const vvipGate = await makeGate(evt1, 'VVIP Gate', true)
  const disabledGate = await makeGate(evt1, 'Closed Side Gate', false)
  // The established business rule: Regular → Main; VIP → Main + VIP; VVIP → VVIP.
  for (const [typeId, gateId] of [[typeRegular.id, mainGate], [typeVip.id, mainGate], [typeVip.id, vipGate], [typeVvip.id, vvipGate]] as const) await pool.query('INSERT INTO ticketug.ticket_type_gate (ticket_type_id, gate_id) VALUES ($1,$2)', [typeId, gateId])
  const assign = async (eventId: string, profileId: string, gateId: string | null) => await pool.query('INSERT INTO ticketug.event_staff_assignment (id, event_id, user_profile_id, gate_id, status) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), eventId, profileId, gateId, 'ACTIVE'])
  await assign(evt1, staffMainProfile, mainGate)
  await assign(evt1, staffVipProfile, vipGate)
  await assign(evt1, staffVvipProfile, vvipGate)
  await assign(evt1, staffEventwideProfile, null)
  await assign(evt1, staffDisabledProfile, disabledGate)
  await assign(evt3, staffMainProfile, mainGate)
  await assign(evt4, staffMainProfile, null) // event-wide on the suspended event, so the lifecycle rule is isolated from gate logic

  // Case-insensitive gate-name uniqueness, verified functionally (rolled back).
  const uniqueClient = await pool.connect()
  let caseInsensitive = false
  try {
    await uniqueClient.query('BEGIN')
    const probeEvent = randomUUID()
    await uniqueClient.query(`INSERT INTO ticketug.event (id, organizer_id, public_id, slug, title, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, created_by) VALUES ($1,$2,$3,$4,$5,$6, now() + interval '30 days', now() + interval '31 days', 'PUBLIC', $7, true, $8)`, [probeEvent, organizerId, `pub_probe_${probeEvent.slice(0, 6)}`, 'probe-unique', 'Probe', 'Africa/Kampala', 'SALES_OPEN', ownerProfile])
    await uniqueClient.query('INSERT INTO ticketug.event_gate (id, event_id, name) VALUES ($1,$2,$3)', [randomUUID(), probeEvent, 'Probe Gate'])
    try {
      await uniqueClient.query('INSERT INTO ticketug.event_gate (id, event_id, name) VALUES ($1,$2,$3)', [randomUUID(), probeEvent, 'PROBE GATE'])
    } catch { caseInsensitive = true }
  } catch (error) { console.log('  (probe outer error:', error instanceof Error ? error.message.slice(0, 120) : error, ')') } finally { await uniqueClient.query('ROLLBACK').catch(() => {}); uniqueClient.release() }
  check('gate name uniqueness is case-insensitive (functional probe, rolled back)', caseInsensitive)

  const staffUser = (profileId: string): ApiUser => ({ authUserId: `auth_${profileId}`, profileId, roles: ['ATTENDEE', 'EVENT_STAFF'], organizerMemberships: [{ organizerId, role: 'EVENT_STAFF', status: 'ACTIVE' }] })
  const outsiderUser: ApiUser = { authUserId: `auth_${outsiderProfile}`, profileId: outsiderProfile, roles: ['ATTENDEE'], organizerMemberships: [] }
  const adminUser: ApiUser = { authUserId: 'auth_admin', profileId: outsiderProfile, roles: ['ATTENDEE', 'PLATFORM_ADMIN'], organizerMemberships: [] }
  const ownerUser: ApiUser = { authUserId: `auth_${ownerProfile}`, profileId: ownerProfile, roles: ['ATTENDEE', 'ORGANIZER_OWNER'], organizerMemberships: [{ organizerId, role: 'ORGANIZER_OWNER', status: 'ACTIVE' }] }

  console.log('\nC. REAL ticket issuance (TicketsService.issuePaidOrder)')
  let tickets: Record<string, { publicId: string; credential: string; orderId: string; orderPublicId: string; orderNumber: string }> = {}
  const issueFor = async (label: string, type: { id: string; name: string; price: number }, eventId: string, purchaserProfileId: string | null) => {
    const orderId = randomUUID(); const paymentId = randomUUID(); const orderPublicId = `ord_${randomUUID().slice(0, 12)}`; const orderNumber = `TUG-V-${orderPublicId.slice(4).toUpperCase()}`
    const guestHash = purchaserProfileId ? null : createHash('sha256').update('verify-guest-token-123').digest('hex')
    await pool.query('INSERT INTO ticketug.order (id, public_id, order_number, user_profile_id, purchaser_name, purchaser_email, guest_access_token_hash, status, payment_state, currency, total_minor_units) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [orderId, orderPublicId, orderNumber, purchaserProfileId, 'Verify Buyer', 'verify-buyer@example.com', guestHash, 'PAID', 'PAID', 'UGX', type.price])
    const orderItemId = randomUUID()
    await pool.query('INSERT INTO ticketug.order_item (id, order_id, ticket_type_id, quantity, ticket_name_snapshot, unit_price_minor_units, currency_snapshot, line_total_minor_units) VALUES ($1,$2,$3,1,$4,$5,$6,$5)', [orderItemId, orderId, type.id, type.name, type.price, 'UGX'])
    await pool.query('INSERT INTO ticketug.payment (id, public_id, order_id, provider, amount_minor_units, currency, status, successful_provider_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [paymentId, `pay_${orderPublicId.slice(4)}`, orderId, 'test', type.price, 'UGX', 'SUCCEEDED', 'verify-ref-1'])
    const issued = await db.transaction((client) => ticketsService.issuePaidOrder(client, { orderId, paymentId, providerReference: 'verify-ref-1' }))
    const ticket = issued[0] as unknown as { publicId: string; eventId: string }
    check(`${label}: issuance created 1 ticket on the paid order`, Boolean(ticket) && ticket.eventId === eventId)
    const secret = await pool.query('SELECT credential FROM ticketug.ticket WHERE public_id=$1', [ticket.publicId])
    tickets[label] = { publicId: ticket.publicId, credential: secret.rows[0].credential, orderId, orderPublicId, orderNumber }
  }
  await issueFor('regular1', typeRegular, evt1, buyerProfile)
  await issueFor('regular2', typeRegular, evt1, buyerProfile)
  await issueFor('vip1', typeVip, evt1, buyerProfile)
  await issueFor('vip2', typeVip, evt1, buyerProfile)
  await issueFor('vvip1', typeVvip, evt1, buyerProfile)
  await issueFor('vvip2', typeVvip, evt1, buyerProfile)
  await issueFor('unmapped1', typeUnmapped, evt1, buyerProfile)
  await issueFor('otherEvent', typeEvt2, evt2, buyerProfile)
  await issueFor('cancelledEvent', typeEvt3, evt3, buyerProfile)
  await issueFor('suspendedEvent', typeEvt4, evt4, buyerProfile)
  await issueFor('guestRegular', typeRegular, evt1, null)
  const idempotent = await db.transaction(async (client) => ticketsService.issuePaidOrder(client, { orderId: tickets.regular1.orderId, paymentId: (await pool.query('SELECT id FROM ticketug.payment WHERE order_id=$1', [tickets.regular1.orderId])).rows[0].id, providerReference: 'verify-ref-1' }))
  check('issuance is idempotent (same order+payment+provider reference → no duplicates)', idempotent.length === 1)
  const scanPayload = (label: string) => `ticketug:v1:${tickets[label].credential}`

  // Gate context for the PDF, captured BEFORE the CASCADE phase deletes a gate.
  const vipTypeGateContext = (await pool.query(`SELECT array_agg(g.name ORDER BY g.name) AS gates FROM ticketug.ticket_type_gate ttg JOIN ticketug.event_gate g ON g.id=ttg.gate_id WHERE ttg.ticket_type_id=(SELECT ticket_type_id FROM ticketug.ticket WHERE public_id=$1) AND g.is_active=true`, [tickets.vip1.publicId])).rows[0].gates
  check('PDF gate context matches the business rule (VIP → Main + VIP)', JSON.stringify(vipTypeGateContext) === JSON.stringify(['Main Gate', 'VIP Gate']), `got ${JSON.stringify(vipTypeGateContext)}`)

  console.log('\nD. REAL scanner decisions (CheckInsService.scan — server-authoritative)')
  const staffMain = staffUser(staffMainProfile)
  const staffVip = staffUser(staffVipProfile)
  const staffVvip = staffUser(staffVvipProfile)
  const staffEventwide = staffUser(staffEventwideProfile)
  const staffDisabled = staffUser(staffDisabledProfile)
  // Established business rule: Regular → Main Gate only.
  await expectOutcome('Regular ticket at Main Gate', checkInsService.scan(staffMain, evt1, scanPayload('regular1')), 'VALID', (r) => r.permittedGates === undefined)
  await expectOutcome('replay of the same ticket', checkInsService.scan(staffMain, evt1, scanPayload('regular1')), 'ALREADY_CHECKED_IN')
  await expectOutcome('Regular ticket at VIP Gate', checkInsService.scan(staffVip, evt1, scanPayload('regular2')), 'WRONG_GATE', (r) => Array.isArray(r.permittedGates) && r.permittedGates.includes('Main Gate') && !r.permittedGates.includes('VIP Gate'))
  await expectOutcome('VIP ticket at Main Gate (permitted: Main+VIP)', checkInsService.scan(staffMain, evt1, scanPayload('vip1')), 'VALID')
  await expectOutcome('VIP ticket at VVIP Gate', checkInsService.scan(staffVvip, evt1, scanPayload('vip2')), 'WRONG_GATE')
  await expectOutcome('VVIP ticket at VVIP Gate', checkInsService.scan(staffVvip, evt1, scanPayload('vvip1')), 'VALID')
  await expectOutcome('VVIP ticket at Main Gate (fresh ticket)', checkInsService.scan(staffMain, evt1, scanPayload('vvip2')), 'WRONG_GATE')
  await expectOutcome('unmapped ticket type on a gated event (fail-closed)', checkInsService.scan(staffMain, evt1, scanPayload('unmapped1')), 'WRONG_GATE')
  await expectOutcome('event-wide staff assignment scans without gate filtering', checkInsService.scan(staffEventwide, evt1, scanPayload('regular2')), 'VALID')
  await expectOutcome('disabled-gate assignment fails closed', checkInsService.scan(staffDisabled, evt1, scanPayload('vip1')), 'UNAUTHORIZED_SCANNER')
  await expectOutcome('staff with no assignment on the event', checkInsService.scan(staffUser(outsiderProfile), evt1, scanPayload('vip1')), 'UNAUTHORIZED_SCANNER')
  await expectOutcome('unauthenticated outsider', checkInsService.scan(outsiderUser, evt1, scanPayload('vip1')), 'UNAUTHORIZED_SCANNER')
  await expectOutcome('ticket belonging to another event', checkInsService.scan(staffMain, evt1, scanPayload('otherEvent')), 'WRONG_EVENT')
  await expectOutcome('malformed QR payload', checkInsService.scan(staffMain, evt1, 'not-a-ticketug-payload'), 'INVALID_QR')
  await expectOutcome('well-formed but unknown credential', checkInsService.scan(staffMain, evt1, 'ticketug:v1:tkt_doesnotexist0000000000'), 'INVALID_TICKET')
  await expectOutcome('ticket on a CANCELLED event', checkInsService.scan(staffMain, evt3, scanPayload('cancelledEvent')), 'EVENT_NOT_AVAILABLE')
  await expectOutcome('SUSPENDED event stays scannable by design (sales pause, not entry pause) — existing rule locked in', checkInsService.scan(staffMain, evt4, scanPayload('suspendedEvent')), 'VALID')
  await expectOutcome('platform admin bypass scans validly (documented behavior)', checkInsService.scan(adminUser, evt1, scanPayload('vip2')), 'VALID')

  console.log('\nE. Gate deletion CASCADE (fail-closed, never widened)')
  const checkPerms = (await pool.query('SELECT count(*)::int AS n FROM ticketug.ticket_type_gate WHERE gate_id=$1', [vipGate])).rows[0].n
  await pool.query('DELETE FROM ticketug.event_gate WHERE id=$1', [vipGate])
  const afterPerms = (await pool.query('SELECT count(*)::int AS n FROM ticketug.ticket_type_gate WHERE gate_id=$1', [vipGate])).rows[0].n
  check('VIP-gate permission rows removed with the gate', checkPerms === 1 && afterPerms === 0)
  const staffVipAssignment = (await pool.query('SELECT count(*)::int AS n FROM ticketug.event_staff_assignment WHERE gate_id=$1', [vipGate])).rows[0].n
  check('VIP-gate staff assignment removed with the gate (not widened to event-wide)', staffVipAssignment === 0)
  await expectOutcome('former VIP-gate scanner is now unauthorized (fail-closed)', checkInsService.scan(staffVip, evt1, scanPayload('vip1')), 'UNAUTHORIZED_SCANNER')
  const mainPerms = (await pool.query('SELECT count(*)::int AS n FROM ticketug.ticket_type_gate WHERE gate_id=$1', [mainGate])).rows[0].n
  check('other gates untouched by the CASCADE', mainPerms === 2)
  const ticketCount = (await pool.query('SELECT count(*)::int AS n FROM ticketug.ticket')).rows[0].n
  check('ticket data intact after gate operations', ticketCount === 11)

  console.log('\nF. REAL DB-backed PDF generation (TicketsService.pdfMine / pdfGuest)')
  const buyerUser: ApiUser = { authUserId: `auth_${buyerProfile}`, profileId: buyerProfile, roles: ['ATTENDEE'], organizerMemberships: [] }
  const ownerPdf = await ticketsService.pdfMine(buyerUser, tickets.regular1.publicId)
  check('owner PDF generated from authoritative rows', ownerPdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-' && ownerPdf.filename === `ticketug-ticket-${tickets.regular1.publicId}.pdf`, `filename ${ownerPdf.filename}`)
  const guestPdf = await ticketsService.pdfGuest(tickets.guestRegular.orderPublicId, tickets.guestRegular.publicId, 'verify-guest-token-123')
  check('guest PDF generated with the order access token', guestPdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-')
  let pdfDenied = false
  try { await ticketsService.pdfGuest(tickets.guestRegular.orderPublicId, tickets.guestRegular.publicId, 'wrong-token') } catch { pdfDenied = true }
  check('guest PDF refuses a wrong access token', pdfDenied)

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`)
  await pool.end()
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (error) => { console.error('VERIFY FAIL:', error); process.exit(1) })
