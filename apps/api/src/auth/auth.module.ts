import { Global, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { SupabaseAuthGuard } from './supabase-auth.guard.js'

@Global()
@Module({ providers: [{ provide: APP_GUARD, useClass: SupabaseAuthGuard }, SupabaseAuthGuard], exports: [SupabaseAuthGuard] })
export class AuthModule {}
