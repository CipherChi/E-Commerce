import { PaymentMethod, SalePaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
class SaleLineDto {
  @IsString() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsIn(['NORMAL', 'PARTY']) pricingOption?: 'NORMAL' | 'PARTY';
}
export class CreateSaleDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() guestName?: string;
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
  @IsEnum(SalePaymentStatus) paymentStatus!: SalePaymentStatus;
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) amountPaid?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  items!: SaleLineDto[];
}
