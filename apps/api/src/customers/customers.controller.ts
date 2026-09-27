import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Req() req: Request & { user: { businessId: string } }, @Query('q') query?: string) {
    return this.customers.list(req.user.businessId, query);
  }
  @Get(':id')
  get(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.customers.get(req.user.businessId, id);
  }
  @Post()
  create(@Req() req: Request & { user: { businessId: string } }, @Body() dto: CreateCustomerDto) {
    return this.customers.create(req.user.businessId, dto);
  }
  @Patch(':id')
  update(
    @Req() req: Request & { user: { businessId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(req.user.businessId, id, dto);
  }
  @Delete(':id')
  remove(@Req() req: Request & { user: { businessId: string } }, @Param('id') id: string) {
    return this.customers.remove(req.user.businessId, id);
  }
}
