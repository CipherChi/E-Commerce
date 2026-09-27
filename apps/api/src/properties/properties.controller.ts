import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@ApiTags('properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get() list(@Req() req: Request & { user: { businessId: string } }) {
    return this.properties.list(req.user.businessId);
  }
  @Get(':id') get(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.properties.get(req.user.businessId, id);
  }
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(
    @Req() req: Request & { user: { sub: string; businessId: string } },
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.create(req.user.sub, req.user.businessId, dto);
  }
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  update(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(req.user.businessId, id, dto);
  }
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.properties.remove(req.user.businessId, id);
  }
}
