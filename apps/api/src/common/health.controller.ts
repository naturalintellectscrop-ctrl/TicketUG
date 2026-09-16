import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { DatabaseService } from './database.service'

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  @Get('health') health() { return { status: 'ok', service: 'ticketug-api' } }
  @Get('readiness') async readiness() { await this.db.query('SELECT 1'); return { status: 'ready', database: 'ok' } }
}
