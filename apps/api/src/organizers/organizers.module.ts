import { Module } from '@nestjs/common'
import { OrganizersController } from './organizers.controller'
@Module({ controllers: [OrganizersController] })
export class OrganizersModule {}
