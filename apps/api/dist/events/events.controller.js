var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, Patch, Post, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
import { assertTransition, EVENT_STATES, publicationStateForTransition } from './event-lifecycle';
import { CreateEventDto, CreateMediaDto, CreateVenueDto, TransitionEventDto, UpdateEventDto } from './event.dto';
const writeRoles = ['ORGANIZER_OWNER', 'ORGANIZER_MANAGER'];
const ownerRoles = ['ORGANIZER_OWNER'];
let EventsController = class EventsController {
    db;
    constructor(db) {
        this.db = db;
    }
    membership(user, organizerId, roles = writeRoles) {
        const membership = user.organizerMemberships.find((item) => item.organizerId === organizerId && item.status === 'ACTIVE');
        if (!membership || !roles.includes(membership.role))
            throw new ForbiddenException('Organizer access denied');
        return membership;
    }
    async ownedEvent(user, eventId, roles = writeRoles) {
        const result = await this.db.query('SELECT id, organizer_id, lifecycle_state, venue_id FROM ticketug.event WHERE id = $1', [eventId]);
        const event = result.rows[0];
        if (!event)
            throw new NotFoundException('Event not found');
        this.membership(user, event.organizer_id, roles);
        return event;
    }
    async assertVenueOwnership(venueId, organizerId) {
        if (!venueId)
            return;
        const result = await this.db.query('SELECT id FROM ticketug.venue WHERE id = $1 AND organizer_id = $2', [venueId, organizerId]);
        if (!result.rows[0])
            throw new BadRequestException('Venue does not belong to organizer');
    }
    assertValidEventWindow(startsAt, endsAt) {
        if (new Date(endsAt) <= new Date(startsAt))
            throw new BadRequestException('Event end must be after start');
    }
    async list(user, organizerId) { this.membership(user, organizerId); return (await this.db.query('SELECT id, public_id, slug, title, description, timezone, starts_at, ends_at, publication_state, lifecycle_state, discoverable, venue_id, created_at, updated_at FROM ticketug.event WHERE organizer_id = $1 ORDER BY starts_at DESC', [organizerId])).rows; }
    async create(user, organizerId, body) { this.membership(user, organizerId); this.assertValidEventWindow(body.startsAt, body.endsAt); await this.assertVenueOwnership(body.venueId, organizerId); const id = randomUUID(); const result = await this.db.query('INSERT INTO ticketug.event (id, organizer_id, venue_id, public_id, slug, title, description, timezone, starts_at, ends_at, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *', [id, organizerId, body.venueId ?? null, `evt_${id.replaceAll('-', '').slice(0, 16)}`, body.slug, body.title, body.description, body.timezone, body.startsAt, body.endsAt, user.profileId]); return result.rows[0]; }
    async get(user, eventId) { const event = await this.ownedEvent(user, eventId); return (await this.db.query('SELECT e.*, COALESCE(json_agg(em ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.event_media em ON em.event_id = e.id WHERE e.id = $1 GROUP BY e.id', [event.id])).rows[0]; }
    async update(user, eventId, body) { const event = await this.ownedEvent(user, eventId); const current = (await this.db.query('SELECT starts_at, ends_at FROM ticketug.event WHERE id = $1', [event.id])).rows[0]; const startsAt = body.startsAt ?? current.starts_at; const endsAt = body.endsAt ?? current.ends_at; this.assertValidEventWindow(startsAt, endsAt); const venueId = body.venueId === undefined ? event.venue_id : body.venueId; await this.assertVenueOwnership(venueId, event.organizer_id); const result = await this.db.query('UPDATE ticketug.event SET title = COALESCE($2,title), description = COALESCE($3,description), starts_at = COALESCE($4,starts_at), ends_at = COALESCE($5,ends_at), slug = COALESCE($6,slug), venue_id = $7, updated_at = now() WHERE id = $1 RETURNING *', [event.id, body.title ?? null, body.description ?? null, body.startsAt ?? null, body.endsAt ?? null, body.slug ?? null, venueId]); return result.rows[0]; }
    async transition(user, eventId, body) { const event = await this.ownedEvent(user, eventId, body.to === 'PUBLISHED' || body.to === 'CANCELLED' ? ownerRoles : writeRoles); if (!EVENT_STATES.includes(body.to))
        throw new BadRequestException('Unknown lifecycle state'); try {
        assertTransition(event.lifecycle_state, body.to);
    }
    catch {
        throw new BadRequestException('Invalid event lifecycle transition');
    } const publicationState = publicationStateForTransition(body.to); const discoverable = body.to === 'PUBLISHED'; const query = publicationState ? 'UPDATE ticketug.event SET lifecycle_state=$2, publication_state=$3, discoverable=$4, updated_at=now() WHERE id=$1 RETURNING *' : 'UPDATE ticketug.event SET lifecycle_state=$2, discoverable=$3, updated_at=now() WHERE id=$1 RETURNING *'; const values = publicationState ? [event.id, body.to, publicationState, discoverable] : [event.id, body.to, discoverable]; return (await this.db.query(query, values)).rows[0]; }
    async addMedia(user, eventId, body) { const event = await this.ownedEvent(user, eventId); return (await this.db.query('INSERT INTO ticketug.event_media (id,event_id,storage_key,url,alt_text,media_type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), event.id, body.storageKey, body.url, body.altText ?? '', body.mediaType ?? 'IMAGE'])).rows[0]; }
    async deleteMedia(user, eventId, mediaId) { const event = await this.ownedEvent(user, eventId); const result = await this.db.query('DELETE FROM ticketug.event_media WHERE id=$1 AND event_id=$2', [mediaId, event.id]); if (result.rowCount === 0)
        throw new NotFoundException('Media not found'); return { deleted: true }; }
    async createVenue(user, organizerId, body) { this.membership(user, organizerId); return (await this.db.query('INSERT INTO ticketug.venue (id,organizer_id,name,address_line1,address_line2,city,region,country_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [randomUUID(), organizerId, body.name, body.addressLine1 ?? null, body.addressLine2 ?? null, body.city ?? null, body.region ?? null, body.countryCode ?? 'UG'])).rows[0]; }
    async publicEvent(slug) { const result = await this.db.query('SELECT e.public_id, e.slug, e.title, e.description, e.timezone, e.starts_at, e.ends_at, v.name AS venue_name, v.city AS venue_city, COALESCE(json_agg(json_build_object(\'url\',em.url,\'altText\',em.alt_text,\'mediaType\',em.media_type,\'sortOrder\',em.sort_order) ORDER BY em.sort_order) FILTER (WHERE em.id IS NOT NULL), \'[]\') AS media FROM ticketug.event e LEFT JOIN ticketug.venue v ON v.id=e.venue_id LEFT JOIN ticketug.event_media em ON em.event_id=e.id WHERE e.slug=$1 AND e.publication_state=\'PUBLIC\' AND e.discoverable=true GROUP BY e.id,v.name,v.city', [slug]); if (!result.rows[0])
        throw new NotFoundException('Event not found'); return result.rows[0]; }
};
__decorate([
    Get('organizers/:organizerId/events'),
    __param(0, CurrentUser()),
    __param(1, Param('organizerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "list", null);
__decorate([
    Post('organizers/:organizerId/events'),
    __param(0, CurrentUser()),
    __param(1, Param('organizerId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateEventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "create", null);
__decorate([
    Get('events/:eventId'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "get", null);
__decorate([
    Patch('events/:eventId'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateEventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "update", null);
__decorate([
    Post('events/:eventId/transition'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TransitionEventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "transition", null);
__decorate([
    Post('events/:eventId/media'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateMediaDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "addMedia", null);
__decorate([
    Delete('events/:eventId/media/:mediaId'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __param(2, Param('mediaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "deleteMedia", null);
__decorate([
    Post('organizers/:organizerId/venues'),
    __param(0, CurrentUser()),
    __param(1, Param('organizerId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateVenueDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "createVenue", null);
__decorate([
    Get('public/events/:slug'),
    __param(0, Param('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "publicEvent", null);
EventsController = __decorate([
    ApiTags('events'),
    Controller(),
    __param(0, Inject(DatabaseService)),
    __metadata("design:paramtypes", [DatabaseService])
], EventsController);
export { EventsController };
