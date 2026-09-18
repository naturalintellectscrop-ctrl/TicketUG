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
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrderDto } from './order.dto';
import { OrdersService } from './orders.service';
let OrdersController = class OrdersController {
    orders;
    constructor(orders) {
        this.orders = orders;
    }
    create(user, body) { return this.orders.create(user, body); }
    list(user) { return this.orders.listMine(user); }
    get(user, publicId) { return this.orders.getMine(user, publicId); }
    cancel(user, publicId) { return this.orders.cancel(user, publicId); }
    eventOrders(user, eventId) { return this.orders.listForEvent(user, eventId); }
    guest(body) { return this.orders.create(null, body, true); }
    guestGet(publicId, token) { if (!token)
        throw new UnauthorizedException('Guest access token required'); return this.orders.getGuest(publicId, token); }
};
__decorate([
    Post('orders'),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    Get('orders'),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "list", null);
__decorate([
    Get('orders/:publicId'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "get", null);
__decorate([
    Patch('orders/:publicId/cancel'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "cancel", null);
__decorate([
    Get('organizer/events/:eventId/orders'),
    __param(0, CurrentUser()),
    __param(1, Param('eventId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "eventOrders", null);
__decorate([
    Post('public/orders/guest'),
    __param(0, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "guest", null);
__decorate([
    Get('public/orders/:publicId'),
    __param(0, Param('publicId')),
    __param(1, Headers('x-order-access-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "guestGet", null);
OrdersController = __decorate([
    ApiTags('orders'),
    Controller(),
    __param(0, Inject(OrdersService)),
    __metadata("design:paramtypes", [OrdersService])
], OrdersController);
export { OrdersController };
