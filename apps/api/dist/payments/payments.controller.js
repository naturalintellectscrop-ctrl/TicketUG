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
import { Body, Controller, Get, Headers, Inject, Param, Post, Req, UnprocessableEntityException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { InitiatePaymentDto } from './payment.dto';
import { PaymentsService } from './payments.service';
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    initiate(user, publicId, body) { return this.payments.initiate(user, publicId, body); }
    status(user, publicId) { return this.payments.status(user, publicId); }
    guestInitiate(publicId, token, body) { return this.payments.initiateGuest(publicId, token, body); }
    guestStatus(publicId, token) { return this.payments.statusGuest(publicId, token); }
    simulateTestSuccess(publicId, token) { return this.payments.simulateTestSuccess(publicId, token); }
    webhook(provider, headers, body, request) { if (!request.rawBody)
        throw new UnprocessableEntityException('RAW_WEBHOOK_BODY_REQUIRED'); return this.payments.webhook(provider, headers, body, request.rawBody.toString('utf8')); }
};
__decorate([
    Post('orders/:publicId/payment'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, InitiatePaymentDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "initiate", null);
__decorate([
    Get('orders/:publicId/payment'),
    __param(0, CurrentUser()),
    __param(1, Param('publicId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "status", null);
__decorate([
    Post('public/orders/:publicId/payment'),
    __param(0, Param('publicId')),
    __param(1, Headers('x-order-access-token')),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, InitiatePaymentDto]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "guestInitiate", null);
__decorate([
    Get('public/orders/:publicId/payment'),
    __param(0, Param('publicId')),
    __param(1, Headers('x-order-access-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "guestStatus", null);
__decorate([
    Post('public/orders/:publicId/payment/test-complete'),
    __param(0, Param('publicId')),
    __param(1, Headers('x-order-access-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "simulateTestSuccess", null);
__decorate([
    Post('public/payments/webhooks/:provider'),
    __param(0, Param('provider')),
    __param(1, Headers()),
    __param(2, Body()),
    __param(3, Req()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "webhook", null);
PaymentsController = __decorate([
    ApiTags('payments'),
    Controller(),
    __param(0, Inject(PaymentsService)),
    __metadata("design:paramtypes", [PaymentsService])
], PaymentsController);
export { PaymentsController };
