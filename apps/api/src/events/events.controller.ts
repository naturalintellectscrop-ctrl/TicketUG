import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, Patch, Post, NotFoundException, BadRequestException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { randomUUID } from 'node:crypto'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'
import { assertTransition, EVENT_STATES, type EventLifecycleState } from './event-lifecycle'
import { CreateEventDto, CreateMediaDto, CreateVenueDto, TransitionEventDto, UpdateEventDto } from './event.dto'

const writeRoles = ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER']
const ownerRoles = ['ORGANIZER_OWNER']

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private membership(user: ApiUser, organizerId: string, roles = writeRoles) {
    const membership = user.organizerMemberships.find((item) => item.organizerId === organizerId && item.status === 'ACTIVE')
    if (!membership || !roles.includes(membership.role)) throw new ForbiddenException('Organizer access denied')
    return membership
  }
  private async ownedEvent(user: ApiUser, eventId: string, roles = writeRoles) {
    const result = await this.db.query<{ id: string; organizer_id: string; lifecycle_state: EventLifecycleState }>('SELECT id, organizer_id, lifecycle_state FROM ticketug.event WHERE id = $1', [eventId])
    const event = result.rows[0]
    if (!event) throw new NotFoundException('Event not found')
    this.membership(user, event.organizer_id, roles)
    return event
  }
  @Get('organizers/:organizerId/events') async list(@CurrentUser() user: ApiUser, @Param('organizerId') organizerId: string) { this.membership(user, organizerId); return (await this.db.query('SELECT id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, venue_id, created_at, updated_at FROM ticketug.event WHERE organizer_id = $1 ORDER BY starts_at DESC', [organizerId])).rows }
  @Post('organizers/:organizerId/events') async create(@CurrentUser() user: ApiUser, @Param('organizerId') organizerId: string, @Body() body: CreateEventDto) { this.membership(user, organizerId); if (new Date(body.endsAt) <= new Date(body.startsAt)) throw new BadRequestException('Event end must be after start'); const id = randomUUID(); const result = await this.db.query('INSERT INTO ticketug.event (id, organizer_id, venue_id, public_id, slug, title, description, timezone, starts_at, ends_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [id, organizerId, body.venueId ?? null, `evt_${id.replaceAll('-', '').slice(0, 16)}`, body.slug, body.title, body.description, body.timezone, body.startsAt, body.endsAt, user.profileId]); return result.rows[0] }
  @Get('events/:eventId') async get(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { const event = await this.ownedEvent(user, eventId); return (await this.db.query('SELECT e.*, COALESCE(json_agg(em ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.event_media em ON em.event_id = e.id WHERE e.id = $1 GROUP BY e.id', [event.id])).rows[0] }
  @Patch('events/:eventId') async update(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Body() body: UpdateEventDto) { const event = await this.ownedEvent(user, eventId); const result = await this.db.query('UPDATE ticketug.event SET title = COALESCE($2,title), description = COALESCE($3,description), starts_at = COALESCE($4,starts_at), ends_at = COALESCE($5,ends_at), slug = COALESCE($6,slug), venue_id = $7, updated_at = now() WHERE id = $1 RETURNING *', [event.id, body.title ?? null, body.description ?? null, body.startsAt ?? null, body.endsAt ?? null, body.slug ?? null, body.venueId === undefined ? (await this.db.query<{ venue_id: string | null }>('SELECT venue_id FROM ticketug.event WHERE id=$1',[event.id])).rows[0].venue_id : body.venueId]); return result.rows[0] }
  @Post('events/:eventId/transition') async transition(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Body() body: TransitionEventDto) { const event = await this.ownedEvent(user, eventId, body.to === 'PUBLISHED' || body.to === 'CANCELLED' ? ownerRoles : writeRoles); if (!(EVENT_STATES as readonly string[]).includes(body.to)) throw new BadRequestException('Unknown lifecycle state'); try { assertTransition(event.lifecycle_state, body.to as EventLifecycleState) } catch { throw new BadRequestException('Invalid event lifecycle transition') } const published = body.to === 'PUBLISHED'; return (await this.db.query('UPDATE ticketug.event SET lifecycle_state=$2, publication_state=$3, discoverable=$4, updated_at=now() WHERE id=$1 RETURNING *', [event.id, body.to, published ? 'PUBLIC' : body.to === 'DRAFT' ? 'PRIVATE' : undefined, published])).rows[0] }
  @Post('events/:eventId/media') async addMedia(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Body() body: CreateMediaDto) { const event = await this.ownedEvent(user, eventId); return (await this.db.query('INSERT INTO ticketug.event_media (id,event_id,storage_key,url,alt_text,media_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), event.id, body.storageKey, body.url, body.altText ?? '', body.mediaType ?? 'IMAGE'])).rows[0] }
  @Delete('events/:eventId/media/:mediaId') async deleteMedia(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Param('mediaId') mediaId: string) { const event = await this.ownedEvent(user, eventId); await this.db.query('DELETE FROM ticketug.event_media WHERE id=$1 AND event_id=$2', [mediaId,event.id]); return { deleted: true } }
  @Post('organizers/:organizerId/venues') async createVenue(@CurrentUser() user: ApiUser, @Param('organizerId') organizerId: string, @Body() body: CreateVenueDto) { this.membership(user, organizerId); return (await this.db.query('INSERT INTO ticketug.venue (id,organizer_id,name,address_line1,address_line2,city,region,country_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [randomUUID(),organizerId,body.name,body.addressLine1 ?? null,body.addressLine2 ?? null,body.city ?? null,body.region ?? null,body.countryCode ?? 'UG'])).rows[0] }
  @Get('public/events/:slug') async publicEvent(@Param('slug') slug: string) { const result = await this.db.query('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type,\'sortOrder\',em.sort_order) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,v.name,v.city', [slug]); if (!result.rows[0]) throw new NotFoundException('Event not found'); return result.rows[0] }
}
