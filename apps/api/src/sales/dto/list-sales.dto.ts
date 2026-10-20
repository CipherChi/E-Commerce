import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSalesDto {
  @IsString() @IsOptional() from?: string;
  @IsString() @IsOptional() to?: string;
  @IsString() @IsOptional() customerId?: string;
  @IsString() @IsOptional() paymentMethod?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() paymentStatus?: string;
  @IsString() @IsOptional() recordedById?: string;
  @IsString() @IsOptional() q?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 25;
}
