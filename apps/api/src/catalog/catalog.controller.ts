import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessModuleType } from '@prisma/client';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogService } from './catalog.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/catalog.dto';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get() list(
    @Req() req: Request & { user: { businessId: string; role?: string } },
    @Query('module') module?: BusinessModuleType,
    @Query('category') category?: string,
    @Query('is_stockable') is_stockable?: string,
    @Query('is_archived') is_archived?: string,
  ) {
    return this.catalog.list(req.user.businessId, { module, category, is_stockable, is_archived }).then(items => req.user.role === 'OWNER' ? items : items.map(({ costPrice, ...item }) => item));
  }
  @Get('categories') categories(@Req() req: Request & { user: { businessId: string } }) {
    return this.catalog.categories(req.user.businessId);
  }
  @Get(':id') get(@Req() req: Request & { user: { businessId: string; role?: string } }, @Param('id') id: string) {
    return this.catalog.get(req.user.businessId, id).then(({ costPrice, ...item }) => req.user.role === 'OWNER' ? { costPrice, ...item } : item);
  }
  @Post() @UseGuards(RolesGuard) @Roles('ADMIN') create(
    @Req() req: Request & { user: { businessId: string } },
    @Body() dto: CreateCatalogItemDto,
  ) {
    return this.catalog.create(req.user.businessId, dto);
  }
  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN') update(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalog.update(req.user.businessId, id, dto);
  }
  @Post(':id/archive') @UseGuards(RolesGuard) @Roles('ADMIN') archive(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
  ) {
    return this.catalog.archive(req.user.businessId, id);
  }
}
