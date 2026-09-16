var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength, Matches } from 'class-validator';
export var EventMediaType;
(function (EventMediaType) {
    EventMediaType["IMAGE"] = "IMAGE";
    EventMediaType["VIDEO"] = "VIDEO";
})(EventMediaType || (EventMediaType = {}));
export class CreateEventDto {
    title;
    description = '';
    startsAt;
    endsAt;
    timezone = 'Africa/Kampala';
    slug;
    venueId;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(180),
    __metadata("design:type", String)
], CreateEventDto.prototype, "title", void 0);
__decorate([
    IsString(),
    MaxLength(5000),
    __metadata("design:type", Object)
], CreateEventDto.prototype, "description", void 0);
__decorate([
    IsISO8601(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "startsAt", void 0);
__decorate([
    IsISO8601(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "endsAt", void 0);
__decorate([
    IsString(),
    Matches(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/),
    __metadata("design:type", Object)
], CreateEventDto.prototype, "timezone", void 0);
__decorate([
    IsString(),
    Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    MaxLength(180),
    __metadata("design:type", String)
], CreateEventDto.prototype, "slug", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], CreateEventDto.prototype, "venueId", void 0);
export class UpdateEventDto {
    title;
    description;
    startsAt;
    endsAt;
    slug;
    venueId;
}
__decorate([
    IsOptional(),
    IsString(),
    IsNotEmpty(),
    MaxLength(180),
    __metadata("design:type", String)
], UpdateEventDto.prototype, "title", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(5000),
    __metadata("design:type", String)
], UpdateEventDto.prototype, "description", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], UpdateEventDto.prototype, "startsAt", void 0);
__decorate([
    IsOptional(),
    IsISO8601(),
    __metadata("design:type", String)
], UpdateEventDto.prototype, "endsAt", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(180),
    __metadata("design:type", String)
], UpdateEventDto.prototype, "slug", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", Object)
], UpdateEventDto.prototype, "venueId", void 0);
export class TransitionEventDto {
    to;
}
__decorate([
    IsString(),
    Length(4, 16),
    __metadata("design:type", String)
], TransitionEventDto.prototype, "to", void 0);
export class CreateVenueDto {
    name;
    addressLine1;
    addressLine2;
    city;
    region;
    countryCode;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(160),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(240),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "addressLine1", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(240),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "addressLine2", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(120),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "city", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(120),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "region", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(2, 2),
    __metadata("design:type", String)
], CreateVenueDto.prototype, "countryCode", void 0);
export class CreateMediaDto {
    storageKey;
    url;
    altText;
    mediaType;
    discoverable;
}
__decorate([
    IsString(),
    IsNotEmpty(),
    MaxLength(512),
    __metadata("design:type", String)
], CreateMediaDto.prototype, "storageKey", void 0);
__decorate([
    IsUrl({ protocols: ['https'] }),
    __metadata("design:type", String)
], CreateMediaDto.prototype, "url", void 0);
__decorate([
    IsOptional(),
    IsString(),
    MaxLength(240),
    __metadata("design:type", String)
], CreateMediaDto.prototype, "altText", void 0);
__decorate([
    IsOptional(),
    IsEnum(EventMediaType),
    __metadata("design:type", String)
], CreateMediaDto.prototype, "mediaType", void 0);
__decorate([
    IsOptional(),
    IsBoolean(),
    __metadata("design:type", Boolean)
], CreateMediaDto.prototype, "discoverable", void 0);
