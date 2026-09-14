import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'
import { assertOrganizerRole, assertPaidOrder } from './ticket.rules'
import { ticketCredentialHash, ticketQrDataUrl } from './ticket.qr'
import type { TicketProjection } from './ticket.contracts'

const projection = `t.public_id,t.order_id,o.public_id AS order_public_id,o.order_number,t.event_id,t.event_title_snapshot AS event_title,t.event_starts_at,t.event_ends_at,t.venue_name_snapshot AS venue_name,t.venue_city_snapshot AS venue_city,t.ticket_type_name_snapshot AS ticket_type_name,t.attendee_name,t.attendee_email,t.status,t.issued_at`
type Row = { public_id: string; order_id: string; order_public_id: string; order_number: string; event_id: string; event_title: string; event_starts_at: string; event_ends_at: string; venue_name: string | null; venue_city: string | null; ticket_type_name: string; attendee_name: string; attendee_email: string; status: TicketProjection['status']; issued_at: string }

@Injectable()
export class TicketsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private present(row: Row): TicketProjection { return { publicId: row.public_id, orderPublicId: row.order_public_id, orderNumber: row.order_number, eventId: row.event_id, eventTitle: row.event_title, eventStartsAt: row.event_starts_at, eventEndsAt: row.event_ends_at, venueName: row.venue_name, venueCity: row.venue_city, ticketTypeName: row.ticket_type_name, attendeeName: row.attendee_name, attendeeEmail: row.attendee_email, status: row.status, issuedAt: row.issued_at } }
  async issuePaidOrder(client: PoolClient, context: { orderId: string; paymentId: string; providerReference: string }) {
    const order = (await client.query<{ id: string; status: string; user_profile_id: string | null; purchaser_name: string; purchaser_email: string }>('SELECT id,status,user_profile_id,purchaser_name,purchaser_email FROM ticketug.order WHERE id=$1 FOR UPDATE', [context.orderId])).rows[0]
    const payment = (await client.query<{ status: string }>('SELECT status FROM ticketug.payment WHERE id=$1 AND order_id=$2 FOR UPDATE', [context.paymentId, context.orderId])).rows[0]
    assertPaidOrder(order?.status ?? '', payment?.status ?? '')
    const existing = (await client.query<{ id: string }>('SELECT id FROM ticketug.ticket_issuance_event WHERE order_id=$1 AND payment_id=$2 AND provider_reference=$3 FOR UPDATE', [context.orderId, context.paymentId, context.providerReference])).rows[0]
    if (existing) return this.rowsForOrder(client, context.orderId)
    const items = (await client.query<any>(`SELECT oi.id AS order_item_id,oi.quantity,oi.ticket_type_id,oi.ticket_name_snapshot,oi.unit_price_minor_units,oi.currency_snapshot,t.event_id,e.title,e.starts_at,e.ends_at,v.name AS venue_name,v.city AS venue_city FROM ticketug.order_item oi JOIN ticketug.ticket_type t ON t.id=oi.ticket_type_id JOIN ticketug.event e ON e.id=t.event_id LEFT JOIN ticketug.venue v ON v.id=e.venue_id WHERE oi.order_id=$1 ORDER BY oi.created_at FOR UPDATE OF oi,t,e`, [context.orderId])).rows
    const total = items.reduce((sum, item) => sum + Number(item.quantity), 0)
    for (const item of items) for (let unit = 1; unit <= item.quantity; unit++) {
      const credential = `tkt_${randomBytes(32).toString('base64url')}`
      await client.query(`INSERT INTO ticketug.ticket(id,public_id,credential,credential_hash,order_id,order_item_id,event_id,ticket_type_id,owner_profile_id,unit_number,attendee_name,attendee_email,ticket_type_name_snapshot,unit_price_minor_units,currency,event_title_snapshot,event_starts_at,event_ends_at,venue_name_snapshot,venue_city_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, [randomUUID(), `tkt_${randomBytes(12).toString('hex')}`, credential, ticketCredentialHash(credential), context.orderId, item.order_item_id, item.event_id, item.ticket_type_id, order.user_profile_id, unit, order.purchaser_name, order.purchaser_email, item.ticket_name_snapshot, item.unit_price_minor_units, item.currency_snapshot, item.title, item.starts_at, item.ends_at, item.venue_name, item.venue_city])
    }
    await client.query(`INSERT INTO ticketug.ticket_issuance_event(id,order_id,payment_id,provider_reference,status,ticket_count,completed_at) VALUES($1,$2,$3,$4,'ISSUED',$5,now())`, [randomUUID(), context.orderId, context.paymentId, context.providerReference, total])
    return this.rowsForOrder(client, context.orderId)
  }
  private async rowsForOrder(client: PoolClient, orderId: string) { return (await client.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.order_id=$1 ORDER BY t.event_id,t.ticket_type_name,t.issued_at,t.public_id`, [orderId])).rows.map((row) => this.present(row)) }
  async listMine(user: ApiUser) { return (await this.db.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.owner_profile_id=$1 ORDER BY t.event_starts_at DESC,t.issued_at DESC`, [user.profileId])).rows.map((row) => this.present(row)) }
  async getMine(user: ApiUser, publicId: string) { const row = (await this.db.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.public_id=$1 AND t.owner_profile_id=$2`, [publicId, user.profileId])).rows[0]; if (!row) throw new NotFoundException('Ticket not found'); return this.present(row) }
  async listOrderMine(user: ApiUser, orderPublicId: string) { const result = await this.db.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE o.public_id=$1 AND o.user_profile_id=$2 ORDER BY t.issued_at`, [orderPublicId, user.profileId]); return result.rows.map((row) => this.present(row)) }
  async listGuest(orderPublicId: string, token: string) { const hash = createHash('sha256').update(token).digest('hex'); const result = await this.db.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE o.public_id=$1 AND o.guest_access_token_hash=$2 ORDER BY t.issued_at`, [orderPublicId, hash]); return result.rows.map((row) => this.present(row)) }
  async listEvent(user: ApiUser, eventId: string) { const event = (await this.db.query<{ organizer_id: string }>('SELECT organizer_id FROM ticketug.event WHERE id=$1', [eventId])).rows[0]; if (!event) throw new NotFoundException('Event not found'); assertOrganizerRole(user.organizerMemberships.find((item) => item.organizerId === event.organizer_id && item.status === 'ACTIVE')?.role); return (await this.db.query<Row>(`SELECT ${projection} FROM ticketug.ticket t JOIN ticketug.order o ON o.id=t.order_id WHERE t.event_id=$1 ORDER BY t.issued_at DESC`, [eventId])).rows.map((row) => this.present(row)) }
  async digital(user: ApiUser, publicId: string) { const ticket = await this.getMine(user, publicId); const secret = (await this.db.query<{ credential: string }>('SELECT credential FROM ticketug.ticket WHERE public_id=$1 AND owner_profile_id=$2', [publicId, user.profileId])).rows[0]; return { ...ticket, qrDataUrl: secret?.credential ? await ticketQrDataUrl(secret.credential) : undefined } }
}
