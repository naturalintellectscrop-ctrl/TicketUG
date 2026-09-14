import { Body, Controller, Get, Headers, Inject, Param, Post, Req, UnprocessableEntityException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { InitiatePaymentDto } from './payment.dto'
import { PaymentsService } from './payments.service'

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}
  @Post('orders/:publicId/payment') initiate(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string, @Body() body: InitiatePaymentDto) { return this.payments.initiate(user, publicId, body) }
  @Get('orders/:publicId/payment') status(@CurrentUser() user: ApiUser, @Param('publicId') publicId: string) { return this.payments.status(user, publicId) }
  @Post('public/orders/:publicId/payment') guestInitiate(@Param('publicId') publicId: string, @Headers('x-order-access-token') token: string, @Body() body: InitiatePaymentDto) { return this.payments.initiateGuest(publicId, token, body) }
  @Get('public/orders/:publicId/payment') guestStatus(@Param('publicId') publicId: string, @Headers('x-order-access-token') token: string) { return this.payments.statusGuest(publicId, token) }
  @Post('public/payments/webhooks/:provider') webhook(@Param('provider') provider: string, @Headers() headers: Record<string, string | undefined>, @Body() body: unknown, @Req() request: { rawBody?: Buffer }) { if (!request.rawBody) throw new UnprocessableEntityException('RAW_WEBHOOK_BODY_REQUIRED'); return this.payments.webhook(provider, headers, body, request.rawBody.toString('utf8')) }
}
