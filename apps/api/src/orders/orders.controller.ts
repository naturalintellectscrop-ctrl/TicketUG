import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { CreateOrderDto } from './order.dto'
import { OrdersService } from './orders.service'

@ApiTags('orders')
@Controller()
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Post('orders') create(@CurrentUser() user: ApiUser, @Body() body: CreateOrderDto) { return this.orders.create(user, body) }
  @Get('orders') list(@CurrentUser() user: ApiUser) { return this.orders.listMine(user) }
  @Get('orders/:publicId') get(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.orders.getMine(user, publicId) }
  @Patch('orders/:publicId/cancel') cancel(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.orders.cancel(user, publicId) }
  @Get('organizer/events/:eventId/orders') eventOrders(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { return this.orders.listForEvent(user, eventId) }
  @Post('public/orders/guest') guest(@Body() body: CreateOrderDto) { return this.orders.create(null, body, true) }
  @Get('public/orders/:publicId') guestGet(@Param('publicId') publicId: string, @Headers('x-order-access-token') token?: string) { if (!token) throw new UnauthorizedException('Guest access token required'); return this.orders.getGuest(publicId, token) }
}
