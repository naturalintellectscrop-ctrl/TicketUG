import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module.js'
import { CommonModule } from './common/common.module.js'
import { UsersModule } from './users/users.module.js'
import { OrganizersModule } from './organizers/organizers.module.js'
import { AuditModule } from './audit/audit.module.js'
import { FutureDomainsModule } from './future-domains.module.js'
import { EventsModule } from './events/events.module.js'
import { TicketTypesModule } from './ticket-types/ticket-types.module.js'
import { OrdersModule } from './orders/orders.module.js'
import { PaymentsModule } from './payments/payments.module.js'
import { TicketsModule } from './tickets/tickets.module.js'
import { CheckInsModule } from './check-ins/check-ins.module.js'

@Module({ imports: [CommonModule, AuthModule, UsersModule, OrganizersModule, AuditModule, FutureDomainsModule, EventsModule, TicketTypesModule, OrdersModule, PaymentsModule, TicketsModule, CheckInsModule] })
export class AppModule {}
