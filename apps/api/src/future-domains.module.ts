import { Module } from '@nestjs/common'

@Module({})
export class FutureDomainsModule {}

export const FUTURE_DOMAIN_BOUNDARIES = ['events','tickets','orders','payments','settlements','refunds','check-in','notifications','analytics','admin'] as const
