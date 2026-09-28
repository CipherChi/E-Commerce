import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount must be a positive decimal with at most two places' })
  amount!: string;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() reference?: string;
}
