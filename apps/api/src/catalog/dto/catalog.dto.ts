import { BusinessModuleType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
export class CreateCatalogItemDto {
  @IsString() name!: string;
  @IsEnum(BusinessModuleType) module!: BusinessModuleType;
  @IsOptional() @IsString() category?: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) costPrice!: string;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) sellingPrice!: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isStockable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
}
export class UpdateCatalogItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(BusinessModuleType) module?: BusinessModuleType;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) costPrice?: string;
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) sellingPrice?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isStockable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) lowStockThreshold?: number;
}
