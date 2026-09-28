import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString() @MinLength(1) label!: string;
  @IsString() @MinLength(1) type!: string;
  @Type(() => Number) @IsInt() @Min(1) capacity!: number;
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) basePrice!: string;
  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.AVAILABLE })
  @IsEnum(RoomStatus)
  @IsOptional()
  status?: RoomStatus;
}
