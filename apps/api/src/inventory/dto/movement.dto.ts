import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
export class StockMovementDto {
  @IsString() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() reason?: string;
}
export class StockAdjustmentDto {
  @IsString() productId!: string;
  @Type(() => Number) @IsInt() quantity!: number;
  @IsString() reason!: string;
}
export class MovementQueryDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}
