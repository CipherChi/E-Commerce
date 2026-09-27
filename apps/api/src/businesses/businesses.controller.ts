import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessesService } from './businesses.service';

@ApiTags('businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  create(@Req() req: Request & { user: { sub: string } }, @Body() dto: CreateBusinessDto) {
    return this.businesses.create(req.user.sub, dto);
  }
}
