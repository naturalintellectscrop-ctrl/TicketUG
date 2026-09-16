import { Module } from '@nestjs/common'
import { DatabaseService } from '../common/database.service'
import { OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({ controllers: [OrdersController], providers: [DatabaseService, OrdersService] })
export class OrdersModule {}
