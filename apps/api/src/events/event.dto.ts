import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength, Matches } from 'class-validator'

export enum EventMediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export class CreateEventDto {
  @IsString() @IsNotEmpty() @MaxLength(180) title!: string
  @IsString() @MaxLength(5000) description = ''
  @IsISO8601() startsAt!: string
  @IsISO8601() endsAt!: string
  @IsString() @Matches(/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/) timezone = 'Africa/Kampala'
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(180) slug!: string
  @IsOptional() @IsString() venueId?: string
}

export class UpdateEventDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(180) title?: string
  @IsOptional() @IsString() @MaxLength(5000) description?: string
  @IsOptional() @IsISO8601() startsAt?: string
  @IsOptional() @IsISO8601() endsAt?: string
  @IsOptional() @IsString() @MaxLength(180) slug?: string
  @IsOptional() @IsString() venueId?: string | null
}

export class TransitionEventDto {
  @IsString() @Length(4, 16) to!: string
}

export class CreateVenueDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string
  @IsOptional() @IsString() @MaxLength(240) addressLine1?: string
  @IsOptional() @IsString() @MaxLength(240) addressLine2?: string
  @IsOptional() @IsString() @MaxLength(120) city?: string
  @IsOptional() @IsString() @MaxLength(120) region?: string
  @IsOptional() @IsString() @Length(2, 2) countryCode?: string
}

export class CreateMediaDto {
  @IsString() @IsNotEmpty() @MaxLength(512) storageKey!: string
  @IsUrl({ protocols: ['https'] }) url!: string
  @IsOptional() @IsString() @MaxLength(240) altText?: string
  @IsOptional() @IsEnum(EventMediaType) mediaType?: EventMediaType
  @IsOptional() @IsBoolean() discoverable?: boolean
}
