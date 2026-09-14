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
import { Body, Controller, Get, Inject, Param, Post, ForbiddenException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
class CreateOrganizerDto {
    name;
    slug;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(120),
    __metadata("design:type", String)
], CreateOrganizerDto.prototype, "name", void 0);
__decorate([
    IsString(),
    Matches(/^[a-z0-9-]+$/),
    __metadata("design:type", String)
], CreateOrganizerDto.prototype, "slug", void 0);
let OrganizersController = class OrganizersController {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(user) { return (await this.db.query('SELECT o.id, o.name, o.slug, om.role, om.status FROM ticketug.organizer_member om JOIN ticketug.organizer o ON o.id = om.organizer_id WHERE om.user_profile_id = $1 AND om.status = $2 ORDER BY o.created_at DESC', [user.profileId, 'ACTIVE'])).rows; }
    async create(user, body) { return this.db.transaction(async (client) => { const organizerId = randomUUID(); const membershipId = randomUUID(); const organizer = await client.query('INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES ($1, $2, $3, $4) RETURNING id, name, slug', [organizerId, body.name, body.slug, user.profileId]); await client.query('INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status, invited_by) VALUES ($1, $2, $3, $4, $5, $3)', [membershipId, organizerId, user.profileId, 'ORGANIZER_OWNER', 'ACTIVE']); return organizer.rows[0]; }); }
    async members(user, organizerId) { const access = user.organizerMemberships.some((membership) => membership.organizerId === organizerId); if (!access)
        throw new ForbiddenException('Organizer access denied'); return (await this.db.query('SELECT om.id, om.user_profile_id, om.role, om.status, om.created_at FROM ticketug.organizer_member om WHERE om.organizer_id = $1 ORDER BY om.created_at', [organizerId])).rows; }
};
__decorate([
    Get(),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrganizersController.prototype, "list", null);
__decorate([
    Post(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateOrganizerDto]),
    __metadata("design:returntype", Promise)
], OrganizersController.prototype, "create", null);
__decorate([
    Get(':organizerId/members'),
    __param(0, CurrentUser()),
    __param(1, Param('organizerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], OrganizersController.prototype, "members", null);
OrganizersController = __decorate([
    ApiTags('organizers'),
    Controller('organizers'),
    __param(0, Inject(DatabaseService)),
    __metadata("design:paramtypes", [DatabaseService])
], OrganizersController);
export { OrganizersController };
