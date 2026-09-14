import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { ProviderRegistry } from './payment.provider'

@Module({ controllers: [PaymentsController], providers: [PaymentsService, ProviderRegistry] })
export class PaymentsModule {}
