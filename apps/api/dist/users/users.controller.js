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
import { Body, Controller, Get, Inject, Patch, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
class UpdateProfileDto {
    displayName;
    phone;
    deliveryEmail;
    deliveryPhone;
}
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(120),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "displayName", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(30),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "phone", void 0);
__decorate([
    IsOptional(),
    IsEmail(),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "deliveryEmail", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(30),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "deliveryPhone", void 0);
let UsersController = class UsersController {
    db;
    constructor(db) {
        this.db = db;
    }
    async get(user) { const result = await this.db.query('SELECT id, auth_user_id, display_name, phone, profile_completed_at FROM ticketug.user_profile WHERE id = $1', [user.profileId]); return result.rows[0]; }
    async update(user, body) { const profile = await this.db.query('UPDATE ticketug.user_profile SET display_name = COALESCE($2, display_name), phone = COALESCE($3, phone), profile_completed_at = CASE WHEN COALESCE($2, display_name) IS NOT NULL THEN COALESCE(profile_completed_at, now()) ELSE profile_completed_at END, updated_at = now() WHERE id = $1 RETURNING id, auth_user_id, display_name, phone, profile_completed_at', [user.profileId, body.displayName, body.phone]); if (body.deliveryEmail !== undefined || body.deliveryPhone !== undefined)
        await this.db.query('INSERT INTO ticketug.attendee_profile (user_profile_id, delivery_email, delivery_phone) VALUES ($1, $2, $3) ON CONFLICT (user_profile_id) DO UPDATE SET delivery_email = COALESCE($2, ticketug.attendee_profile.delivery_email), delivery_phone = COALESCE($3, ticketug.attendee_profile.delivery_phone), updated_at = now()', [user.profileId, body.deliveryEmail, body.deliveryPhone]); if (!profile.rows[0])
        throw new UnauthorizedException('Profile not found'); return profile.rows[0]; }
};
__decorate([
    Get(),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "get", null);
__decorate([
    Patch(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "update", null);
UsersController = __decorate([
    ApiTags('users'),
    Controller('users/me'),
    __param(0, Inject(DatabaseService)),
    __metadata("design:paramtypes", [DatabaseService])
], UsersController);
export { UsersController };
