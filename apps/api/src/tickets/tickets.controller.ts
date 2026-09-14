import { Controller, Get, Headers, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { TicketsService } from './tickets.service'

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}
  @Get('tickets') list(@CurrentUser() user: ApiUser) { return this.tickets.listMine(user) }
  @Get('tickets/:publicId') get(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.tickets.digital(user, publicId) }
  @Get('orders/:publicId/tickets') order(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.tickets.listOrderMine(user, publicId) }
  @Get('public/orders/:publicId/tickets') guest(@Param('publicId') publicId: string, @Headers('x-order-access-token') token: string) { return this.tickets.listGuest(publicId, token) }
  @Get('organizer/events/:eventId/tickets') event(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { return this.tickets.listEvent(user, eventId) }
}
