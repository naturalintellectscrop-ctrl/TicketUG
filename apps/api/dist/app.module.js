var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { OrganizersModule } from './organizers/organizers.module';
import { AuditModule } from './audit/audit.module';
import { FutureDomainsModule } from './future-domains.module';
import { EventsModule } from './events/events.module';
import { TicketTypesModule } from './ticket-types/ticket-types.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { TicketsModule } from './tickets/tickets.module';
import { CheckInsModule } from './check-ins/check-ins.module';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({ imports: [CommonModule, AuthModule, UsersModule, OrganizersModule, AuditModule, FutureDomainsModule, EventsModule, TicketTypesModule, OrdersModule, PaymentsModule, TicketsModule, CheckInsModule] })
], AppModule);
export { AppModule };
