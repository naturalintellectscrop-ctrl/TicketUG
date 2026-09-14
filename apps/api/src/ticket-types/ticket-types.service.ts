import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'
import { getTicketAvailability, validateSaleWindow, validateTicketNumbers } from './ticket-type.rules'
import { CreateTicketTypeDto, SetTicketTypeActiveDto, TicketCurrency, UpdateTicketTypeDto } from './ticket-type.dto'

const manageRoles = ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER']

type TicketRow = { id: string; event_id: string; public_id: string; name: string; description: string; price_minor_units: string; currency: string; capacity: number; sale_starts_at: string | null; sale_ends_at: string | null; active: boolean; sort_order: number; created_at: string; updated_at: string }

export class TicketTypesService {
  constructor(private readonly db: DatabaseService) {}

  private membership(user: ApiUser, organizerId: string) {
    const membership = user.organizerMemberships.find((item) => item.organizerId === organizerId && item.status === 'ACTIVE')
    if (!membership || !manageRoles.includes(membership.role)) throw new ForbiddenException('Organizer access denied')
    return membership
  }

  private async ownedEvent(user: ApiUser, eventId: string) {
    const result = await this.db.query<{ id: string; organizer_id: string }>('SELECT id, organizer_id FROM ticketug.event WHERE id = $1', [eventId])
    const event = result.rows[0]
    if (!event) throw new NotFoundException('Event not found')
    this.membership(user, event.organizer_id)
    return event
  }

  private async ownedTicket(user: ApiUser, ticketTypeId: string) {
    const result = await this.db.query<TicketRow & { organizer_id: string }>('SELECT t.*, e.organizer_id FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id = t.event_id WHERE t.id = $1', [ticketTypeId])
    const ticket = result.rows[0]
    if (!ticket) throw new NotFoundException('Ticket type not found')
    this.membership(user, ticket.organizer_id)
    return ticket
  }

  private validateWindow(startsAt?: string | null, endsAt?: string | null) {
    try { validateSaleWindow(startsAt, endsAt) } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid sale window') }
  }

  private present(row: TicketRow, now = new Date()) {
    return { publicId: row.public_id, eventId: row.event_id, name: row.name, description: row.description, priceMinorUnits: Number(row.price_minor_units), currency: row.currency, capacity: row.capacity, saleStartsAt: row.sale_starts_at, saleEndsAt: row.sale_ends_at, active: row.active, sortOrder: row.sort_order, availability: getTicketAvailability({ ...row, now }), createdAt: row.created_at, updatedAt: row.updated_at }
  }

  async list(user: ApiUser, eventId: string) {
    const event = await this.ownedEvent(user, eventId)
    const result = await this.db.query<TicketRow>('SELECT * FROM ticketug.ticket_type WHERE event_id = $1 ORDER BY sort_order, created_at', [event.id])
    return result.rows.map((row) => this.present(row))
  }

  async create(user: ApiUser, eventId: string, body: CreateTicketTypeDto) {
    const event = await this.ownedEvent(user, eventId)
    this.validateWindow(body.saleStartsAt, body.saleEndsAt)
    try { validateTicketNumbers(body.priceMinorUnits, body.capacity) } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid ticket numbers') }
    const id = randomUUID()
    const result = await this.db.query<TicketRow>('INSERT INTO ticketug.ticket_type (id,event_id,public_id,name,description,price_minor_units,currency,capacity,sale_starts_at,sale_ends_at,active,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *', [id, event.id, `tt_${id.replaceAll('-', '').slice(0, 16)}`, body.name, body.description ?? '', body.priceMinorUnits, body.currency ?? TicketCurrency.UGX, body.capacity, body.saleStartsAt ?? null, body.saleEndsAt ?? null, body.active ?? false, body.sortOrder ?? 0])
    return this.present(result.rows[0])
  }

  async get(user: ApiUser, ticketTypeId: string) {
    return this.present(await this.ownedTicket(user, ticketTypeId))
  }

  async update(user: ApiUser, ticketTypeId: string, body: UpdateTicketTypeDto) {
    const ticket = await this.ownedTicket(user, ticketTypeId)
    const saleStartsAt = body.saleStartsAt === undefined ? ticket.sale_starts_at : body.saleStartsAt
    const saleEndsAt = body.saleEndsAt === undefined ? ticket.sale_ends_at : body.saleEndsAt
    this.validateWindow(saleStartsAt, saleEndsAt)
    if (body.priceMinorUnits !== undefined || body.capacity !== undefined) {
      try { validateTicketNumbers(body.priceMinorUnits ?? Number(ticket.price_minor_units), body.capacity ?? ticket.capacity) } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid ticket numbers') }
    }
    const values = [ticket.id, body.name ?? null, body.description ?? null, body.priceMinorUnits ?? null, body.currency ?? null, body.capacity ?? null, saleStartsAt, saleEndsAt, body.active ?? null, body.sortOrder ?? null]
    const result = await this.db.query<TicketRow>('UPDATE ticketug.ticket_type SET name=COALESCE($2,name), description=COALESCE($3,description), price_minor_units=COALESCE($4,price_minor_units), currency=COALESCE($5,currency), capacity=COALESCE($6,capacity), sale_starts_at=$7, sale_ends_at=$8, active=COALESCE($9,active), sort_order=COALESCE($10,sort_order), updated_at=now() WHERE id=$1 RETURNING *', values)
    return this.present(result.rows[0])
  }

  async setActive(user: ApiUser, ticketTypeId: string, body: SetTicketTypeActiveDto) {
    return this.update(user, ticketTypeId, { active: body.active })
  }

  async remove(user: ApiUser, ticketTypeId: string) {
    const ticket = await this.ownedTicket(user, ticketTypeId)
    await this.db.query('UPDATE ticketug.ticket_type SET active=false, updated_at=now() WHERE id=$1', [ticket.id])
    return { deactivated: true }
  }

  async publicForEvent(slug: string) {
    const result = await this.db.query<TicketRow>('SELECT t.* FROM ticketug.ticket_type t JOIN ticketug.event e ON e.id=t.event_id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true AND t.active=true ORDER BY t.sort_order, t.created_at', [slug])
    return result.rows.map((row) => this.present(row)).filter((ticket) => ticket.availability !== 'INACTIVE')
  }
}
