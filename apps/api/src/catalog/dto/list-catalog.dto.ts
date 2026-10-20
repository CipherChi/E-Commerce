import { BusinessModuleType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListCatalogDto {
  @IsEnum(BusinessModuleType) @IsOptional() module?: BusinessModuleType;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() is_stockable?: string;
  @IsString() @IsOptional() is_archived?: string;
  @IsString() @IsOptional() q?: string;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() pageSize = 25;
}
