import { Global, Module } from '@nestjs/common'
import { DatabaseService } from './database.service'
import { HealthController } from './health.controller'

@Global()
@Module({ controllers: [HealthController], providers: [DatabaseService], exports: [DatabaseService] })
export class CommonModule {}
