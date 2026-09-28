import { Module } from '@nestjs/common'
import { CommonModule } from '../common/common.module.js'
import { TicketsController } from './tickets.controller.js'
import { TicketsService } from './tickets.service.js'

@Module({ imports: [CommonModule], controllers: [TicketsController], providers: [TicketsService], exports: [TicketsService] })
export class TicketsModule {}
