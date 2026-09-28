import { Module } from '@nestjs/common'
import { DatabaseService } from '../common/database.service.js'
import { TicketTypesController } from './ticket-types.controller.js'

@Module({ controllers: [TicketTypesController], providers: [DatabaseService] })
export class TicketTypesModule {}
