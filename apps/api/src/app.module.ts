import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { CommonModule } from './common/common.module'
import { UsersModule } from './users/users.module'
import { OrganizersModule } from './organizers/organizers.module'
import { AuditModule } from './audit/audit.module'
import { FutureDomainsModule } from './future-domains.module'
import { EventsModule } from './events/events.module'
import { TicketTypesModule } from './ticket-types/ticket-types.module'
import { OrdersModule } from './orders/orders.module'
import { PaymentsModule } from './payments/payments.module'

@Module({ imports: [CommonModule, AuthModule, UsersModule, OrganizersModule, AuditModule, FutureDomainsModule, EventsModule, TicketTypesModule, OrdersModule, PaymentsModule] })
export class AppModule {}
