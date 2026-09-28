import { Global, Module } from '@nestjs/common'
import { DatabaseService } from './database.service.js'
import { HealthController } from './health.controller.js'

@Global()
@Module({ controllers: [HealthController], providers: [DatabaseService], exports: [DatabaseService] })
export class CommonModule {}
