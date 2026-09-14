import { Body, Controller, Get, Inject, Patch, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'

class UpdateProfileDto { @IsOptional() @IsString() @MaxLength(120) displayName?: string; @IsOptional() @IsString() @MaxLength(30) phone?: string; @IsOptional() @IsEmail() deliveryEmail?: string; @IsOptional() @IsString() @MaxLength(30) deliveryPhone?: string }
@ApiTags('users')
@Controller('users/me')
export class UsersController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get() async get(@CurrentUser() user: ApiUser) { const result = await this.db.query('SELECT id, auth_user_id, display_name, phone, profile_completed_at FROM ticketug.user_profile WHERE id = $1', [user.profileId]); return result.rows[0] }
  @Patch() async update(@CurrentUser() user: ApiUser, @Body() body: UpdateProfileDto) { const profile = await this.db.query('UPDATE ticketug.user_profile SET display_name = COALESCE($2, display_name), phone = COALESCE($3, phone), profile_completed_at = CASE WHEN COALESCE($2, display_name) IS NOT NULL THEN COALESCE(profile_completed_at, now()) ELSE profile_completed_at END, updated_at = now() WHERE id = $1 RETURNING id, auth_user_id, display_name, phone, profile_completed_at', [user.profileId, body.displayName, body.phone]); if (body.deliveryEmail !== undefined || body.deliveryPhone !== undefined) await this.db.query('INSERT INTO ticketug.attendee_profile (user_profile_id, delivery_email, delivery_phone) VALUES ($1, $2, $3) ON CONFLICT (user_profile_id) DO UPDATE SET delivery_email = COALESCE($2, ticketug.attendee_profile.delivery_email), delivery_phone = COALESCE($3, ticketug.attendee_profile.delivery_phone), updated_at = now()', [user.profileId, body.deliveryEmail, body.deliveryPhone]); if (!profile.rows[0]) throw new UnauthorizedException('Profile not found'); return profile.rows[0] }
}
