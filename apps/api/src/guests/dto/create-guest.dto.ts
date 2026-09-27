import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGuestDto {
  @IsString() @MinLength(1) fullName!: string;
  @IsString() @MinLength(3) phone!: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() idType?: string;
  @IsString() @IsOptional() idNumber?: string;
  @IsString() @IsOptional() notes?: string;
}
