var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database.service';
const QR_PREFIX = 'ticketug:v1:';
const allowedRoles = new Set(['EVENT_STAFF', 'ORGANIZER_OWNER', 'ORGANIZER_MANAGER', 'PLATFORM_ADMIN', 'SUPER_ADMIN']);
let CheckInsService = class CheckInsService {
    db;
    constructor(db) {
        this.db = db;
    }
    credentialFromPayload(payload) {
        if (typeof payload !== 'string' || payload.length < QR_PREFIX.length + 16 || payload.length > 180 || !payload.startsWith(QR_PREFIX))
            return null;
        const credential = payload.slice(QR_PREFIX.length);
        return /^tkt_[A-Za-z0-9_-]{16,120}$/.test(credential) ? credential : null;
    }
    async authorized(client, user, eventId) {
        if (user.roles.some((role) => role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN'))
            return true;
        const event = (await client.query('SELECT organizer_id,status FROM ticketug.event WHERE id=$1', [eventId])).rows[0];
        if (!event)
            throw new NotFoundException('Event not found');
        const membership = user.organizerMemberships.find((item) => item.organizerId === event.organizer_id && item.status === 'ACTIVE');
        if (!membership || !allowedRoles.has(membership.role))
            throw new ForbiddenException('Scanner is not authorized for this event');
        if (membership.role === 'EVENT_STAFF') {
            const assignment = (await client.query('SELECT 1 FROM ticketug.event_staff_assignment WHERE event_id=$1 AND user_profile_id=$2 AND status=\'ACTIVE\'', [eventId, user.profileId])).rowCount;
            if (!assignment)
                throw new ForbiddenException('Scanner is not assigned to this event');
        }
        if (event.status === 'CANCELLED')
            throw new ForbiddenException('Event is not available');
        return true;
    }
    async listAssignedEvents(user) {
        const result = await this.db.query(`SELECT e.id,e.title,e.starts_at,e.status FROM ticketug.event e JOIN ticketug.event_staff_assignment a ON a.event_id=e.id WHERE a.user_profile_id=$1 AND a.status='ACTIVE' ORDER BY e.starts_at`, [user.profileId]);
        return result.rows;
    }
    async scan(user, eventId, payload) {
        const credential = this.credentialFromPayload(payload);
        if (!credential)
            return { outcome: 'INVALID_QR' };
        return this.db.transaction(async (client) => {
            try {
                await this.authorized(client, user, eventId);
            }
            catch (error) {
                if (error instanceof ForbiddenException)
                    return { outcome: 'UNAUTHORIZED_SCANNER' };
                throw error;
            }
            const ticket = (await client.query('SELECT id,event_id,status,ticket_type_name_snapshot,attendee_name,event_title_snapshot FROM ticketug.ticket WHERE credential_hash=$1 FOR UPDATE', [createHash('sha256').update(credential).digest('hex')])).rows[0];
            if (!ticket)
                return { outcome: 'INVALID_TICKET' };
            if (ticket.event_id !== eventId)
                return { outcome: 'WRONG_EVENT' };
            if (ticket.status === 'CHECKED_IN') {
                const existing = (await client.query('SELECT checked_in_at FROM ticketug.check_in WHERE ticket_id=$1', [ticket.id])).rows[0];
                return { outcome: 'ALREADY_CHECKED_IN', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: existing?.checked_in_at };
            }
            if (ticket.status === 'CANCELLED')
                return { outcome: 'CANCELLED_TICKET' };
            if (ticket.status === 'REFUNDED')
                return { outcome: 'REFUNDED_TICKET' };
            if (ticket.status === 'VOID')
                return { outcome: 'VOID_TICKET' };
            if (ticket.status !== 'ISSUED')
                return { outcome: 'INVALID_TICKET' };
            await client.query("UPDATE ticketug.ticket SET status='CHECKED_IN' WHERE id=$1 AND status='ISSUED'", [ticket.id]);
            const inserted = (await client.query('INSERT INTO ticketug.check_in(id,ticket_id,event_id,scanner_profile_id) VALUES($1,$2,$3,$4) RETURNING checked_in_at', [randomUUID(), ticket.id, eventId, user.profileId])).rows[0];
            return { outcome: 'VALID', ticketTypeName: ticket.ticket_type_name_snapshot, attendeeName: ticket.attendee_name, eventTitle: ticket.event_title_snapshot, checkedInAt: inserted.checked_in_at };
        });
    }
    async summary(user, eventId) {
        await this.db.transaction((client) => this.authorized(client, user, eventId));
        const counts = (await this.db.query(`SELECT count(*) FILTER (WHERE status IN ('ISSUED','CHECKED_IN')) AS issued,count(*) FILTER (WHERE status='CHECKED_IN') AS checked_in FROM ticketug.ticket WHERE event_id=$1`, [eventId])).rows[0];
        const recent = (await this.db.query('SELECT checked_in_at FROM ticketug.check_in WHERE event_id=$1 ORDER BY checked_in_at DESC LIMIT 20', [eventId])).rows;
        return { issued: Number(counts?.issued ?? 0), checkedIn: Number(counts?.checked_in ?? 0), remaining: Number(counts?.issued ?? 0) - Number(counts?.checked_in ?? 0), recent };
    }
};
CheckInsService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [DatabaseService])
], CheckInsService);
export { CheckInsService };
