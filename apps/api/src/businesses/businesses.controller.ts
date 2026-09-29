import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessModuleType } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateBusinessDto } from './dto/create-business.dto';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { BusinessesService } from './businesses.service';

class ModuleUpdateDto { @IsEnum(BusinessModuleType) module!: BusinessModuleType; @IsBoolean() isEnabled!: boolean; }
class CreateStaffDto { @IsString() name!: string; @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
type AuthReq = Request & { user: { sub: string; businessId: string } };
@ApiTags('businesses') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}
  @Post() create(@Req() req: AuthReq, @Body() dto: CreateBusinessDto) { return this.businesses.create(req.user.sub, dto); }
  @Get('profile') @UseGuards(BusinessContextGuard) profile(@Req() req: AuthReq) { return this.businesses.profile(req.user.businessId); }
  @Get('modules') @UseGuards(BusinessContextGuard) modules(@Req() req: AuthReq) { return this.businesses.modules(req.user.businessId); }
  @Patch('modules') @UseGuards(BusinessContextGuard, RolesGuard) @Roles('ADMIN') setModule(@Req() req: AuthReq, @Body() dto: ModuleUpdateDto) { return this.businesses.setModule(req.user.businessId, dto.module, dto.isEnabled); }
  @Get('staff') @UseGuards(BusinessContextGuard, RolesGuard) @Roles('ADMIN') staff(@Req() req: AuthReq) { return this.businesses.staff(req.user.businessId); }
  @Post('staff') @UseGuards(BusinessContextGuard, RolesGuard) @Roles('ADMIN') createStaff(@Req() req: AuthReq, @Body() dto: CreateStaffDto) { return this.businesses.createStaff(req.user.businessId, dto); }
  @Patch('staff/:userId') @UseGuards(BusinessContextGuard, RolesGuard) @Roles('ADMIN') setStaffActive(@Req() req: AuthReq, @Param('userId') userId: string, @Body() dto: { isActive: boolean }) { return this.businesses.setStaffActive(req.user.businessId, userId, dto.isActive); }
}
