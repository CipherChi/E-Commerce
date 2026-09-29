import { BookingSource, BookingStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBookingDto {
  @IsEnum(BookingStatus) @IsOptional() status?: BookingStatus;
  @IsString() @MinLength(1) @IsOptional() roomId?: string;
  @IsString() @MinLength(1) @IsOptional() customerId?: string;
  @IsDateString({ strict: true }) @IsOptional() checkIn?: string;
  @IsDateString({ strict: true }) @IsOptional() checkOut?: string;
  @IsEnum(BookingSource) @IsOptional() source?: BookingSource;
}
