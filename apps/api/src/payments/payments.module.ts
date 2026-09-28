import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller.js'
import { PaymentsService } from './payments.service.js'
import { ProviderRegistry } from './payment.provider.js'
import { TicketsModule } from '../tickets/tickets.module.js'

@Module({ imports: [TicketsModule], controllers: [PaymentsController], providers: [PaymentsService, ProviderRegistry] })
export class PaymentsModule {}
