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
import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { TicketsService } from './tickets.service';
let TicketsController = class TicketsController {
    tickets;
    constructor(tickets) {
        this.tickets = tickets;
    }
    list(user) { return this.tickets.listMine(user); }
    get(user, publicId) { return this.tickets.digital(user, publicId); }
    order(user, publicId) { return this.tickets.listOrderMine(user, publicId); }
    guest(publicId, token) { return this.tickets.listGuest(publicId, token); }
    guestDetail(publicId, ticketPublicId, token) { return this.tickets.digitalGuest(publicId, ticketPublicId, token); }
    event(user, eventId) { return this.tickets.listEvent(user, eventId); }
};
__decorate([
    Get('tickets'),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "list", null);
__decorate([
    Get('tickets/:publicId'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "get", null);
__decorate([
    Get('orders/:publicId/tickets'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "order", null);
__decorate([
    Get('public/orders/:publicId/tickets'),
    __param(0, Param('publicId')),
    __param(1, Headers('x-order-access-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "guest", null);
__decorate([
    Get('public/orders/:publicId/tickets/:ticketPublicId'),
    __param(0, Param('publicId')),
    __param(1, Param('ticketPublicId')),
    __param(2, Headers('x-order-access-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "guestDetail", null);
__decorate([
    Get('organizer/events/:eventId/tickets'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "event", null);
TicketsController = __decorate([
    ApiTags('tickets'),
    Controller(),
    __metadata("design:paramtypes", [TicketsService])
], TicketsController);
export { TicketsController };
