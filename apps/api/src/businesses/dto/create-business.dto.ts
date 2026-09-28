import { BusinessType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString() @MinLength(1) name!: string;
  @IsEnum(BusinessType) primaryType!: BusinessType;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() logo?: string;
}
