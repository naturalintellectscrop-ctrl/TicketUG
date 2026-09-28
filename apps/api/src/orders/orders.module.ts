import { Module } from '@nestjs/common'
import { DatabaseService } from '../common/database.service.js'
import { OrdersController } from './orders.controller.js'
import { OrdersService } from './orders.service.js'

@Module({ controllers: [OrdersController], providers: [DatabaseService, OrdersService] })
export class OrdersModule {}
