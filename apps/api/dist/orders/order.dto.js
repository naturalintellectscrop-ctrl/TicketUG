var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
export class CreateOrderItemDto {
    ticketTypeId;
    quantity;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    __metadata("design:type", String)
], CreateOrderItemDto.prototype, "ticketTypeId", void 0);
__decorate([
    IsInt(),
    Min(1),
    Max(100),
    __metadata("design:type", Number)
], CreateOrderItemDto.prototype, "quantity", void 0);
export class CreateOrderDto {
    items;
    purchaserName;
    purchaserEmail;
    idempotencyKey;
}
__decorate([
    ValidateNested({ each: true }),
    Type(() => CreateOrderItemDto),
    __metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(180),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "purchaserName", void 0);
__decorate([
    IsEmail(),
    MaxLength(320),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "purchaserEmail", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(128),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "idempotencyKey", void 0);
export class CancelOrderDto {
    reason;
}
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], CancelOrderDto.prototype, "reason", void 0);
