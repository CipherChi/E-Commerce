import { BusinessModuleType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
export class CreateCatalogItemDto {
  @IsString() name!: string;
  @IsEnum(BusinessModuleType) module!: BusinessModuleType;
  @IsOptional() @IsString() category?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costPrice!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice!: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isStockable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
}
export class UpdateCatalogItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(BusinessModuleType) module?: BusinessModuleType;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) costPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) sellingPrice?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isStockable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
}
