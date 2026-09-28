import { Controller, Get, Headers, Param, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.decorator.js'
import type { ApiUser } from '../auth/auth.types.js'
import { TicketsService } from './tickets.service.js'

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}
  @Get('tickets') list(@CurrentUser() user: ApiUser) { return this.tickets.listMine(user) }
  @Get('tickets/:publicId') get(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.tickets.digital(user, publicId) }
  @Get('orders/:publicId/tickets') order(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.tickets.listOrderMine(user, publicId) }
  @Get('public/orders/:publicId/tickets') guest(@Param('publicId') publicId: string, @Headers('x-order-access-token') token: string) { return this.tickets.listGuest(publicId, token) }
  @Get('public/orders/:publicId/tickets/:ticketPublicId') guestDetail(@Param('publicId') publicId: string, @Param('ticketPublicId') ticketPublicId: string, @Headers('x-order-access-token') token: string) { return this.tickets.digitalGuest(publicId, ticketPublicId, token) }
  @Get('organizer/events/:eventId/tickets') event(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { return this.tickets.listEvent(user, eventId) }

  // PDF tickets — authorization is identical to the digital ticket surfaces
  // (owner session / guest access token). Generated on demand and streamed with
  // no-store so one user's ticket can never be cached for another.
  @Get('tickets/:publicId/pdf')
  async pdf(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string, @Res() response: Response) {
    const { buffer, filename } = await this.tickets.pdfMine(user, publicId)
    response.type('application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    response.setHeader('Cache-Control', 'no-store')
    response.send(buffer)
  }

  @Get('public/orders/:publicId/tickets/:ticketPublicId/pdf')
  async guestPdf(@Param('publicId') publicId: string, @Param('ticketPublicId') ticketPublicId: string, @Headers('x-order-access-token') token: string, @Res() response: Response) {
    const { buffer, filename } = await this.tickets.pdfGuest(publicId, ticketPublicId, token)
    response.type('application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    response.setHeader('Cache-Control', 'no-store')
    response.send(buffer)
  }
}
