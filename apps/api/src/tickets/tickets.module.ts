import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'

@Module({ imports: [CommonModule], controllers: [TicketsController], providers: [TicketsService], exports: [TicketsService] })
export class TicketsModule {}
