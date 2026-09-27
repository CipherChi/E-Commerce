import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() logo?: string;
}
