import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { DatabaseService } from '../common/database.service'
import { CreateTicketTypeDto, SetTicketTypeActiveDto, UpdateTicketTypeDto } from './ticket-type.dto'
import { TicketTypesService } from './ticket-types.service'

@ApiTags('ticket-types')
@Controller()
export class TicketTypesController {
  private readonly tickets: TicketTypesService
  constructor(@Inject(DatabaseService) db: DatabaseService) { this.tickets = new TicketTypesService(db) }

  @Get('events/:eventId/ticket-types') list(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { return this.tickets.list(user, eventId) }
  @Post('events/:eventId/ticket-types') create(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Body() body: CreateTicketTypeDto) { return this.tickets.create(user, eventId, body) }
  @Get('ticket-types/:ticketTypeId') get(@CurrentUser() user: ApiUser, @Param('ticketTypeId') ticketTypeId: string) { return this.tickets.get(user, ticketTypeId) }
  @Patch('ticket-types/:ticketTypeId') update(@CurrentUser() user: ApiUser, @Param('ticketTypeId') ticketTypeId: string, @Body() body: UpdateTicketTypeDto) { return this.tickets.update(user, ticketTypeId, body) }
  @Post('ticket-types/:ticketTypeId/active') setActive(@CurrentUser() user: ApiUser, @Param('ticketTypeId') ticketTypeId: string, @Body() body: SetTicketTypeActiveDto) { return this.tickets.setActive(user, ticketTypeId, body) }
  @Delete('ticket-types/:ticketTypeId') deactivate(@CurrentUser() user: ApiUser, @Param('ticketTypeId') ticketTypeId: string) { return this.tickets.remove(user, ticketTypeId) }
  @Get('public/events/:slug/ticket-types') publicTicketTypes(@Param('slug') slug: string) { return this.tickets.publicForEvent(slug) }
}
