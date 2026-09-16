import { IsBoolean, IsEnum, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export enum TicketCurrency {
  UGX = 'UGX',
}

export class CreateTicketTypeDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string
  @IsOptional() @IsString() @MaxLength(5000) description?: string
  @IsInt() @Min(0) @Max(9007199254740991) priceMinorUnits!: number
  @IsOptional() @IsEnum(TicketCurrency) currency?: TicketCurrency
  @IsInt() @Min(0) @Max(2147483647) capacity!: number
  @IsOptional() @IsISO8601() saleStartsAt?: string
  @IsOptional() @IsISO8601() saleEndsAt?: string
  @IsOptional() @IsBoolean() active?: boolean
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) sortOrder?: number
}

export class UpdateTicketTypeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160) name?: string
  @IsOptional() @IsString() @MaxLength(5000) description?: string
  @IsOptional() @IsInt() @Min(0) @Max(9007199254740991) priceMinorUnits?: number
  @IsOptional() @IsEnum(TicketCurrency) currency?: TicketCurrency
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) capacity?: number
  @IsOptional() @IsISO8601() saleStartsAt?: string | null
  @IsOptional() @IsISO8601() saleEndsAt?: string | null
  @IsOptional() @IsBoolean() active?: boolean
  @IsOptional() @IsInt() @Min(0) @Max(2147483647) sortOrder?: number
}

export class SetTicketTypeActiveDto {
  @IsBoolean() active!: boolean
}
