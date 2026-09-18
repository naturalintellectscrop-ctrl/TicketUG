var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export var TicketCurrency;
(function (TicketCurrency) {
    TicketCurrency["UGX"] = "UGX";
})(TicketCurrency || (TicketCurrency = {}));
export class CreateTicketTypeDto {
    name;
    description;
    priceMinorUnits;
    currency;
    capacity;
    saleStartsAt;
    saleEndsAt;
    active;
    sortOrder;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(160),
    __metadata("design:type", String)
], CreateTicketTypeDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", String)
], CreateTicketTypeDto.prototype, "description", void 0);
__decorate([
    IsInt(),
    Min(0),
    Max(9007199254740991),
    __metadata("design:type", Number)
], CreateTicketTypeDto.prototype, "priceMinorUnits", void 0);
__decorate([
    IsOptional(),
    IsEnum(TicketCurrency),
    __metadata("design:type", String)
], CreateTicketTypeDto.prototype, "currency", void 0);
__decorate([
    IsInt(),
    Min(0),
    Max(2147483647),
    __metadata("design:type", Number)
], CreateTicketTypeDto.prototype, "capacity", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], CreateTicketTypeDto.prototype, "saleStartsAt", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], CreateTicketTypeDto.prototype, "saleEndsAt", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateTicketTypeDto.prototype, "active", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(2147483647),
    __metadata("design:type", Number)
], CreateTicketTypeDto.prototype, "sortOrder", void 0);
export class UpdateTicketTypeDto {
    name;
    description;
    priceMinorUnits;
    currency;
    capacity;
    saleStartsAt;
    saleEndsAt;
    active;
    sortOrder;
}
__decorate([
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    MaxLength(160),
    __metadata("design:type", String)
], UpdateTicketTypeDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", String)
], UpdateTicketTypeDto.prototype, "description", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(9007199254740991),
    __metadata("design:type", Number)
], UpdateTicketTypeDto.prototype, "priceMinorUnits", void 0);
__decorate([
    IsOptional(),
    IsEnum(TicketCurrency),
    __metadata("design:type", String)
], UpdateTicketTypeDto.prototype, "currency", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(2147483647),
    __metadata("design:type", Number)
], UpdateTicketTypeDto.prototype, "capacity", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", Object)
], UpdateTicketTypeDto.prototype, "saleStartsAt", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", Object)
], UpdateTicketTypeDto.prototype, "saleEndsAt", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], UpdateTicketTypeDto.prototype, "active", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(2147483647),
    __metadata("design:type", Number)
], UpdateTicketTypeDto.prototype, "sortOrder", void 0);
export class SetTicketTypeActiveDto {
    active;
}
__decorate([
    IsBoolean(),
    __metadata("design:type", Boolean)
], SetTicketTypeActiveDto.prototype, "active", void 0);
