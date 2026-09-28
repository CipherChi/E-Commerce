import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessModuleType } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessesService } from './businesses.service';

class ModuleUpdateDto { @IsEnum(BusinessModuleType) module!: BusinessModuleType; @IsBoolean() isEnabled!: boolean; }
type AuthReq = Request & { user: { sub: string; businessId: string } };
@ApiTags('businesses') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}
  @Post() create(@Req() req: AuthReq, @Body() dto: CreateBusinessDto) { return this.businesses.create(req.user.sub, dto); }
  @Get('profile') @UseGuards(BusinessContextGuard) profile(@Req() req: AuthReq) { return this.businesses.profile(req.user.businessId); }
  @Get('modules') @UseGuards(BusinessContextGuard) modules(@Req() req: AuthReq) { return this.businesses.modules(req.user.businessId); }
  @Patch('modules') @UseGuards(BusinessContextGuard) setModule(@Req() req: AuthReq, @Body() dto: ModuleUpdateDto) { return this.businesses.setModule(req.user.businessId, dto.module, dto.isEnabled); }
}
