import { BusinessType } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(1) name!: string;
  @IsEnum(BusinessType) primaryType!: BusinessType;
}
