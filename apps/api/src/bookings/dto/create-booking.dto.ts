import { BookingSource } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBookingDto {
  @IsString() @MinLength(1) roomId!: string;
  @IsString() @MinLength(1) customerId!: string;
  @IsDateString({ strict: true }) checkIn!: string;
  @IsDateString({ strict: true }) checkOut!: string;
  @IsEnum(BookingSource) @IsOptional() source?: BookingSource;
}
