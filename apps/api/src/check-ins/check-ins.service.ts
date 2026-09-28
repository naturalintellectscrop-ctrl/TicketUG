import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { ApiUser } from '../auth/auth.types.js'
import { DatabaseService } from '../common/database.service.js'
import { assignmentGrantsScanning, gateAllowsTicketType } from './gate.rules.js'

const QR_PREFIX = 'ticketug:v1:'
const allowedRoles = new Set(['EVENT_STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'])

type ScanResult = {
  outcome: 'VALID' | 'ALREADY_CHECKED_IN' | 'INVALID_QR' | 'INVALID_TICKET' | 'WRONG_EVENT' | 'WRONG_GATE' | 'CANCELLED_TICKET' | 'REFUNDED_TICKET' | 'VOID_TICKET' | 'UNAUTHORIZED_SCANNER' | 'EVENT_NOT_AVAILABLE'
  ticketTypeName?: string
  attendeeName?: string
  eventTitle?: string
  checkedInAt?: string
  permittedGates?: string[]
}

@Injectable()
export class CheckInsService {
  constructor(private readonly db: DatabaseService) {}

  private credentialFromPayload(payload: string) {
    if (typeof payload !== 'string' || payload.length < QR_PREFIX.length + 16 || payload.length > 180 || !payload.startsWith(QR_PREFIX)) return null
    const credential = payload.slice(QR_PREFIX.length)
    return /^tkt_[A-Za-z0-9_-]{16,120}$/.test(credential) ? credential : null
  }

  // Returns the scanner's gate scope (null = event-wide, the pre-gate behavior)
  // and whether the event is cancelled. Throws ForbiddenException for missing
  // role/assignment so callers can map it to UNAUTHORIZED_SCANNER; cancellation
  // is returned instead of thrown so the scan flow can answer EVENT_NOT_AVAILABLE
  // precisely (previously a cancelled event surfaced as UNAUTHORIZED_SCANNER).
  private async authorized(client: PoolClient, user: ApiUser, eventId: string): Promise<{ gateId: string | null; cancelled: boolean }> {
    if (user.roles.some((role) => role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN')) return { gateId: null, cancelled: false }
    const event = (await client.query<{ organizer_id: string; status: string }>('SELECT organizer_id,lifecycle_state AS status FROM ticketug.event WHERE id=$1', [eventId])).rows[0]
    if (!event) throw new NotFoundException('Event not found')
    const membership = user.organizerMemberships.find((item) => item.organizerId === event.organizer_id && item.status === 'ACTIVE')
    if (!membership || !allowedRoles.has(membership.role)) throw new ForbiddenException('Scanner is not authorized for this event')
    let gateId: string | null = null
    if (membership.role === 'EVENT_STAFF') {
      const assignment = (await client.query<{ gate_id: string | null; gate_active: boolean | null }>(`SELECT a.gate_id, g.is_active AS gate_active FROM ticketug.event_staff_assignment a LEFT JOIN ticketug.event_gate g ON g.id=a.gate_id WHERE a.event_id=$1 AND a.user_profile_id=$2 AND a.status='ACTIVE'`, [eventId, user.profileId])).rows[0]
      if (!assignment || !assignmentGrantsScanning({ gateId: assignment.gate_id, gateActive: assignment.gate_active })) throw new ForbiddenException('Scanner is not assigned to this event')
      gateId = assignment.gate_id
    }
    return { gateId, cancelled: event.status === 'CANCELLED' }
  }

  async listAssignedEvents(user: ApiUser) {
    // Assigned event staff see their assignments; organizer owners/managers also see every
    // event of organizers they actively manage (they pass scan authorization without an assignment).
    const result = await this.db.query<{ id: string; title: string; starts_at: string; status: string; gateId: string | null; gateName: string | null }>(`SELECT DISTINCT e.id,e.title,e.starts_at,e.lifecycle_state AS status,a.gate_id AS "gateId",g.name AS "gateName" FROM ticketug.event e LEFT JOIN ticketug.event_staff_assignment a ON a.event_id=e.id AND a.user_profile_id=$1 AND a.status='ACTIVE' LEFT JOIN ticketug.event_gate g ON g.id=a.gate_id WHERE a.id IS NOT NULL OR EXISTS (SELECT 1 FROM ticketug.organizer_member om WHERE om.organizer_id=e.organizer_id AND om.user_profile_id=$1 AND om.status='ACTIVE' AND om.role IN ('ORGANIZER_OWNER','ORGANIZER_MANAGER')) ORDER BY e.starts_at`, [user.profileId])
    return result.rows
  }

  async scan(user: ApiUser, eventId: string, payload: string): Promise<ScanResult> {
    const credential = this.credentialFromPayload(payload)
    if (!credential) return { outcome: 'INVALID_QR' }
    return this.db.transaction(async (client) => {
      let authz: { gateId: string | null; cancelled: boolean }
      try { authz = await this.authorized(client, user, eventId) } catch (error) { if (error instanceof ForbiddenException) return { outcome: 'UNAUTHORIZED_SCANNER' }; throw error }
      if (authz.cancelled) return { outcome: 'EVENT_NOT_AVAILABLE' }
      const ticket = (await client.query<{ id: string; event_id: string; status: string; ticket_type_id: string; ticket_type_name_snapshot: string; attendee_name: string; event_title_snapshot: string }>('SELECT id,event_id,status,ticket_type_id,ticket_type_name_snapshot,attendee_name,event_title_snapshot FROM ticketug.ticket WHERE credential_hash=$1 FOR UPDATE', [createHash('sha256').update(credential).digest('hex')])).rows[0]
      if (!ticket) return { outcome: 'INVALID_TICKET' }
      if (ticket.event_id !== eventId) return { outcome: 'WRONG_EVENT' }
      if (ticket.status === 'CHECKED_IN') { const existing = (await client.query<{ checked_in_at: string }>('SELECT checked_in_at FROM ticketug.check_in WHERE ticket_id=$1', [ticket.id])).rows[0]; return { outcome: 'ALREADY_CHECKED_IN', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: existing?.checked_in_at } }
      if (ticket.status === 'CANCELLED') return { outcome: 'CANCELLED_TICKET' }
      if (ticket.status === 'REFUNDED') return { outcome: 'REFUNDED_TICKET' }
      if (ticket.status === 'VOID') return { outcome: 'VOID_TICKET' }
      if (ticket.status !== 'ISSUED') return { outcome: 'INVALID_TICKET' }
      if (authz.gateId) {
        const permitted = (await client.query<{ id: string; name: string }>(`SELECT g.id, g.name FROM ticketug.ticket_type_gate ttg JOIN ticketug.event_gate g ON g.id=ttg.gate_id WHERE ttg.ticket_type_id=$1 AND g.event_id=$2 AND g.is_active=true ORDER BY g.name`, [ticket.ticket_type_id, eventId])).rows
        const decision = gateAllowsTicketType(authz.gateId, permitted.map((gate) => gate.id))
        if (!decision.allowed) return { outcome: 'WRONG_GATE', permittedGates: permitted.map((gate) => gate.name), ticketTypeName: ticket.ticket_type_name_snapshot, eventTitle: ticket.event_title_snapshot }
      }
      await client.query("UPDATE ticketug.ticket SET status='CHECKED_IN' WHERE id=$1 AND status='ISSUED'", [ticket.id])
      const inserted = (await client.query<{ checked_in_at: string }>('INSERT INTO ticketug.check_in(id,ticket_id,event_id,scanner_profile_id) VALUES($1,$2,$3,$4) RETURNING checked_in_at', [randomUUID(), ticket.id, eventId, user.profileId])).rows[0]
      return { outcome: 'VALID', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: inserted.checked_in_at }
    })
  }

  async summary(user: ApiUser, eventId: string) {
    const authz = await this.db.transaction((client) => this.authorized(client, user, eventId))
    if (authz.cancelled) throw new ForbiddenException('Event is not available')
    const counts = (await this.db.query<{ issued: string; checked_in: string }>(`SELECT count(*) FILTER (WHERE status IN ('ISSUED','CHECKED_IN')) AS issued,count(*) FILTER (WHERE status='CHECKED_IN') AS checked_in FROM ticketug.ticket WHERE event_id=$1`, [eventId])).rows[0]
    const recent = (await this.db.query('SELECT checked_in_at FROM ticketug.check_in WHERE event_id=$1 ORDER BY checked_in_at DESC LIMIT 20', [eventId])).rows
    return { issued: Number(counts?.issued ?? 0), checkedIn: Number(counts?.checked_in ?? 0), remaining: Number(counts?.issued ?? 0) - Number(counts?.checked_in ?? 0), recent }
  }
}
