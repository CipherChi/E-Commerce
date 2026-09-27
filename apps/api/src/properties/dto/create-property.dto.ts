import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePropertyDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) address!: string;
  @ApiPropertyOptional({ enum: PropertyType, default: PropertyType.HOTEL })
  @IsEnum(PropertyType)
  @IsOptional()
  type?: PropertyType;
}
