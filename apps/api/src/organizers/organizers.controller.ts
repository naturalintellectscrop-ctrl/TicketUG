import { Body, Controller, Get, Inject, Param, Post, ForbiddenException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'
import { randomUUID } from 'node:crypto'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'

class CreateOrganizerDto { @IsString() @IsNotEmpty() @MaxLength(120) name!: string; @IsString() @Matches(/^[a-z0-9-]+$/) slug!: string }
@ApiTags('organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get() async list(@CurrentUser() user: ApiUser) { return (await this.db.query('SELECT o.id, o.name, o.slug, om.role, om.status FROM ticketug.organizer_member om JOIN ticketug.organizer o ON o.id = om.organizer_id WHERE om.user_profile_id = $1 AND om.status = $2 ORDER BY o.created_at DESC', [user.profileId, 'ACTIVE'])).rows }
  @Post() async create(@CurrentUser() user: ApiUser, @Body() body: CreateOrganizerDto) { return this.db.transaction(async (client) => { const organizerId = randomUUID(); const membershipId = randomUUID(); const organizer = await client.query('INSERT INTO ticketug.organizer (id, name, slug, created_by) VALUES ($1, $2, $3, $4) RETURNING id, name, slug', [organizerId, body.name, body.slug, user.profileId]); await client.query('INSERT INTO ticketug.organizer_member (id, organizer_id, user_profile_id, role, status, invited_by) VALUES ($1, $2, $3, $4, $5, $3)', [membershipId, organizerId, user.profileId, 'ORGANIZER_OWNER', 'ACTIVE']); return organizer.rows[0] }) }
  @Get(':organizerId/members') async members(@CurrentUser() user: ApiUser, @Param('organizerId') organizerId: string) { const access = user.organizerMemberships.some((membership) => membership.organizerId === organizerId); if (!access) throw new ForbiddenException('Organizer access denied'); return (await this.db.query('SELECT om.id, om.user_profile_id, om.role, om.status, om.created_at FROM ticketug.organizer_member om WHERE om.organizer_id = $1 ORDER BY om.created_at', [organizerId])).rows }
}
