import { Module } from '@nestjs/common'
import { OrganizersController } from './organizers.controller.js'
@Module({ controllers: [OrganizersController] })
export class OrganizersModule {}
