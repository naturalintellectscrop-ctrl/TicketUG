import { Module } from '@nestjs/common'
import { DatabaseService } from '../common/database.service'
import { TicketTypesController } from './ticket-types.controller'

@Module({ controllers: [TicketTypesController], providers: [DatabaseService] })
export class TicketTypesModule {}
