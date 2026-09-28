import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListBookingsDto {
  @IsDateString({ strict: true }) @IsOptional() from?: string;
  @IsDateString({ strict: true }) @IsOptional() to?: string;
  @IsEnum(BookingStatus) @IsOptional() status?: BookingStatus;
  @IsString() @IsOptional() roomId?: string;
  @IsString() @IsOptional() customerId?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 20;
}
