import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { NeonAuthGuard } from './neon-auth.guard'

@Global()
@Module({ providers: [{ provide: APP_GUARD, useClass: NeonAuthGuard }, NeonAuthGuard], exports: [NeonAuthGuard] })
export class AuthModule {}
