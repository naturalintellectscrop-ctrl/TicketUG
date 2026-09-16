import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { ApiUser } from '../auth/auth.types'
import { CheckInsService } from './check-ins.service'

@ApiTags('check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkIns: CheckInsService) {}
  @Get('events') events(@CurrentUser() user: ApiUser) { return this.checkIns.listAssignedEvents(user) }
  @Post('events/:eventId/scan') scan(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string, @Body() body: { payload?: string }) { return this.checkIns.scan(user, eventId, body?.payload ?? '') }
  @Get('events/:eventId/summary') summary(@CurrentUser() user: ApiUser, @Param('eventId') eventId: string) { return this.checkIns.summary(user, eventId) }
}
