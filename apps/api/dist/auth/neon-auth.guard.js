var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { neonAuth } from './neon-auth';
import { DatabaseService } from '../common/database.service';
import { API_USER } from './auth.types';
let NeonAuthGuard = class NeonAuthGuard {
    db;
    constructor(db) {
        this.db = db;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        if (request.path === '/api/v1/health' || request.path === '/api/v1/readiness' || request.path?.startsWith('/api/v1/docs'))
            return true;
        const cookie = request.headers.cookie;
        if (!cookie)
            throw new UnauthorizedException('Authentication required');
        const session = await neonAuth.getSession({ fetchOptions: { headers: { cookie } } });
        const authUserId = session?.data?.user?.id;
        if (!authUserId)
            throw new UnauthorizedException('Authentication required');
        const profile = await this.db.query('SELECT id FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1', [authUserId]);
        if (!profile.rows[0])
            throw new UnauthorizedException('TicketUG profile required');
        const [memberships, roles] = await Promise.all([
            this.db.query('SELECT organizer_id, role, status FROM ticketug.organizer_member WHERE user_profile_id = $1 AND status = $2', [profile.rows[0].id, 'ACTIVE']),
            this.db.query('SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1', [profile.rows[0].id]),
        ]);
        const user = { authUserId, profileId: profile.rows[0].id, roles: Array.from(new Set(['ATTENDEE', ...memberships.rows.map((row) => row.role), ...roles.rows.map((row) => row.role)])), organizerMemberships: memberships.rows.map((row) => ({ organizerId: row.organizer_id, role: row.role, status: row.status })) };
        request[API_USER] = user;
        return true;
    }
};
NeonAuthGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [DatabaseService])
], NeonAuthGuard);
export { NeonAuthGuard };
