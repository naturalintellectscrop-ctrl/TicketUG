import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class InitiatePaymentDto {
  @IsString() @MinLength(16) @MaxLength(128) idempotencyKey!: string
  @IsOptional() @IsString() @MaxLength(100) provider?: string
}
