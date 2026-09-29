import { createHash, randomUUID } from 'node:crypto'
import { pool, withTransaction } from '@/lib/db'
import { assignmentGrantsScanning, gateAllowsTicketType } from '@/lib/rules/gate-rules'

// Scanner domain — the single server-authoritative check-in implementation
// (Pair 6: extracted from the Next route so the route is thin and the 46-check
// behavioral harness exercises the SAME module the product uses).
//
// The scanner's gate scope is derived from the staff member's ACTIVE assignment
// row — never from the request. Every decision outcome matches the documented
// matrix (CONTINUITY §16/§17): VALID, ALREADY_CHECKED_IN, INVALID_QR,
// INVALID_TICKET, WRONG_EVENT, WRONG_GATE, CANCELLED_TICKET, REFUNDED_TICKET,
// VOID_TICKET, UNAUTHORIZED_SCANNER, EVENT_NOT_AVAILABLE.

const QR_PREFIX = 'ticketug:v1:'
const allowedRoles = new Set(['EVENT_STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'])

export function credentialFromPayload(payload: unknown): string | null {
  if (typeof payload !== 'string' || !payload.startsWith(QR_PREFIX) || payload.length < QR_PREFIX.length + 16 || payload.length > 180) return null
  const credential = payload.slice(QR_PREFIX.length)
  return /^tkt_[A-Za-z0-9_-]{16,120}$/.test(credential) ? credential : null
}

export type ScanResult = {
  outcome: 'VALID' | 'ALREADY_CHECKED_IN' | 'INVALID_QR' | 'INVALID_TICKET' | 'WRONG_EVENT' | 'WRONG_GATE' | 'CANCELLED_TICKET' | 'REFUNDED_TICKET' | 'VOID_TICKET' | 'UNAUTHORIZED_SCANNER' | 'EVENT_NOT_AVAILABLE'
  ticketTypeName?: string
  attendeeName?: string
  eventTitle?: string
  checkedInAt?: string
  permittedGates?: string[]
}

type ScanAuthorization = { ok: boolean; cancelled: boolean; gateId: string | null }

async function authorize(profileId: string, eventId: string): Promise<ScanAuthorization> {
  const result = await pool.query<{ role: string; lifecycle_state: string }>(
    `SELECT om.role, e.lifecycle_state FROM ticketug.event e
       JOIN ticketug.organizer_member om ON om.organizer_id = e.organizer_id
      WHERE e.id = $1 AND om.user_profile_id = $2 AND om.status = 'ACTIVE'`,
    [eventId, profileId],
  )
  const row = result.rows[0]
  const role = row?.role
  const [platformRole] = (await pool.query<{ role: string }>(
    `SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1 AND role IN ('PLATFORM_ADMIN','SUPER_ADMIN') LIMIT 1`,
    [profileId],
  )).rows
  if (!role && !platformRole) return { ok: false, cancelled: false, gateId: null }
  if (role && !allowedRoles.has(role) && !platformRole) return { ok: false, cancelled: false, gateId: null }
  if (platformRole) return { ok: true, cancelled: row?.lifecycle_state === 'CANCELLED', gateId: null }
  let gateId: string | null = null
  if (role === 'EVENT_STAFF') {
    const assignment = (await pool.query<{ gate_id: string | null; gate_active: boolean | null }>(
      `SELECT a.gate_id, g.is_active AS gate_active FROM ticketug.event_staff_assignment a
         LEFT JOIN ticketug.event_gate g ON g.id = a.gate_id
        WHERE a.event_id = $1 AND a.user_profile_id = $2 AND a.status = 'ACTIVE'`,
      [eventId, profileId],
    )).rows[0]
    if (!assignment || !assignmentGrantsScanning({ gateId: assignment.gate_id, gateActive: assignment.gate_active })) return { ok: false, cancelled: false, gateId: null }
    gateId = assignment.gate_id
  }
  return { ok: true, cancelled: row.lifecycle_state === 'CANCELLED', gateId }
}

export async function scanCheckIn(profileId: string, eventId: string, payload: string): Promise<ScanResult> {
  const credential = credentialFromPayload(payload)
  if (!credential) return { outcome: 'INVALID_QR' }
  return withTransaction(async (client) => {
    const authz = await authorize(profileId, eventId)
    if (!authz.ok) return { outcome: 'UNAUTHORIZED_SCANNER' }
    if (authz.cancelled) return { outcome: 'EVENT_NOT_AVAILABLE' }
    const ticket = (await client.query<{ id: string; event_id: string; status: string; ticket_type_id: string; ticket_type_name_snapshot: string; attendee_name: string; event_title_snapshot: string }>(
      'SELECT id, event_id, status, ticket_type_id, ticket_type_name_snapshot, attendee_name, event_title_snapshot FROM ticketug.ticket WHERE credential_hash = $1 FOR UPDATE',
      [createHash('sha256').update(credential).digest('hex')],
    )).rows[0]
    if (!ticket) return { outcome: 'INVALID_TICKET' }
    if (ticket.event_id !== eventId) return { outcome: 'WRONG_EVENT' }
    if (ticket.status === 'CHECKED_IN') {
      const prior = (await client.query<{ checked_in_at: string }>('SELECT checked_in_at FROM ticketug.check_in WHERE ticket_id = $1', [ticket.id])).rows[0]
      return { outcome: 'ALREADY_CHECKED_IN', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: prior?.checked_in_at }
    }
    if (['CANCELLED', 'REFUNDED', 'VOID'].includes(ticket.status)) return { outcome: `${ticket.status}_TICKET` as ScanResult['outcome'], ticketTypeName: ticket.ticket_type_name_snapshot, eventTitle: ticket.event_title_snapshot }
    if (ticket.status !== 'ISSUED') return { outcome: 'INVALID_TICKET' }
    if (authz.gateId) {
      const permitted = (await client.query<{ id: string; name: string }>(
        `SELECT g.id, g.name FROM ticketug.ticket_type_gate ttg JOIN ticketug.event_gate g ON g.id = ttg.gate_id
          WHERE ttg.ticket_type_id = $1 AND g.event_id = $2 AND g.is_active = true ORDER BY g.name`,
        [ticket.ticket_type_id, eventId],
      )).rows
      const decision = gateAllowsTicketType(authz.gateId, permitted.map((gate) => gate.id))
      if (!decision.allowed) return { outcome: 'WRONG_GATE', permittedGates: permitted.map((gate) => gate.name), ticketTypeName: ticket.ticket_type_name_snapshot, eventTitle: ticket.event_title_snapshot }
    }
    const updated = await client.query("UPDATE ticketug.ticket SET status = 'CHECKED_IN' WHERE id = $1 AND status = 'ISSUED'", [ticket.id])
    if (updated.rowCount !== 1) return { outcome: 'ALREADY_CHECKED_IN', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot }
    const checkIn = (await client.query<{ checked_in_at: string }>(
      'INSERT INTO ticketug.check_in (id, ticket_id, event_id, scanner_profile_id) VALUES ($1,$2,$3,$4) RETURNING checked_in_at',
      [randomUUID(), ticket.id, eventId, profileId],
    )).rows[0]
    return { outcome: 'VALID', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: checkIn.checked_in_at }
  })
}

export async function listAssignedEvents(profileId: string) {
  const events = await pool.query(
    `SELECT DISTINCT e.id, e.title, e.starts_at, e.lifecycle_state AS status, a.gate_id AS "gateId", g.name AS "gateName"
       FROM ticketug.event e
       LEFT JOIN ticketug.event_staff_assignment a ON a.event_id = e.id AND a.user_profile_id = $1 AND a.status = 'ACTIVE'
       LEFT JOIN ticketug.event_gate g ON g.id = a.gate_id
      WHERE a.id IS NOT NULL
         OR EXISTS (SELECT 1 FROM ticketug.organizer_member om WHERE om.organizer_id = e.organizer_id AND om.user_profile_id = $1 AND om.status = 'ACTIVE' AND om.role IN ('ORGANIZER_OWNER','ORGANIZER_MANAGER'))
      ORDER BY e.starts_at`,
    [profileId],
  )
  return events.rows
}
