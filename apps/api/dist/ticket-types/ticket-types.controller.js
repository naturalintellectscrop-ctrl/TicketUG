var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { DatabaseService } from '../common/database.service';
import { CreateTicketTypeDto, SetTicketTypeActiveDto, UpdateTicketTypeDto } from './ticket-type.dto';
import { TicketTypesService } from './ticket-types.service';
let TicketTypesController = class TicketTypesController {
    tickets;
    constructor(db) { this.tickets = new TicketTypesService(db); }
    list(user, eventId) { return this.tickets.list(user, eventId); }
    create(user, eventId, body) { return this.tickets.create(user, eventId, body); }
    get(user, ticketTypeId) { return this.tickets.get(user, ticketTypeId); }
    update(user, ticketTypeId, body) { return this.tickets.update(user, ticketTypeId, body); }
    setActive(user, ticketTypeId, body) { return this.tickets.setActive(user, ticketTypeId, body); }
    deactivate(user, ticketTypeId) { return this.tickets.remove(user, ticketTypeId); }
    publicTicketTypes(slug) { return this.tickets.publicForEvent(slug); }
};
__decorate([
    Get('events/:eventId/ticket-types'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "list", null);
__decorate([
    Post('events/:eventId/ticket-types'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CreateTicketTypeDto]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "create", null);
__decorate([
    Get('ticket-types/:ticketTypeId'),
    __param(0, CurrentUser()),
    __param(1, Param('ticketTypeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "get", null);
__decorate([
    Patch('ticket-types/:ticketTypeId'),
    __param(0, CurrentUser()),
    __param(1, Param('ticketTypeId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateTicketTypeDto]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "update", null);
__decorate([
    Post('ticket-types/:ticketTypeId/active'),
    __param(0, CurrentUser()),
    __param(1, Param('ticketTypeId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, SetTicketTypeActiveDto]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "setActive", null);
__decorate([
    Delete('ticket-types/:ticketTypeId'),
    __param(0, CurrentUser()),
    __param(1, Param('ticketTypeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "deactivate", null);
__decorate([
    Get('public/events/:slug/ticket-types'),
    __param(0, Param('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TicketTypesController.prototype, "publicTicketTypes", null);
TicketTypesController = __decorate([
    ApiTags('ticket-types'),
    Controller(),
    __param(0, Inject(DatabaseService)),
    __metadata("design:paramtypes", [DatabaseService])
], TicketTypesController);
export { TicketTypesController };
