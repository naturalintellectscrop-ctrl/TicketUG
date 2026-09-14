import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateOrderItemDto {
  @IsString() @IsNotEmpty() ticketTypeId!: string
  @IsInt() @Min(1) @Max(100) quantity!: number
}

export class CreateOrderDto {
  @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) items!: CreateOrderItemDto[]
  @IsString() @IsNotEmpty() @MaxLength(180) purchaserName!: string
  @IsEmail() @MaxLength(320) purchaserEmail!: string
  @IsOptional() @IsString() @MaxLength(128) idempotencyKey?: string
}

export class CancelOrderDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}
