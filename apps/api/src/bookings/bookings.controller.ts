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
import { BookingStatus } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BusinessContextGuard } from '../auth/business-context.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsService } from './bookings.service';

type TenantRequest = Request & { user: { businessId: string } };

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list(@Req() req: TenantRequest, @Query() query: ListBookingsDto) {
    return this.bookings.list(req.user.businessId, query);
  }

  @Get('availability')
  availability(
    @Req() req: TenantRequest,
    @Query('roomId') roomId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.bookings.availability(req.user.businessId, roomId, checkIn, checkOut);
  }

  @Post()
  create(@Req() req: TenantRequest, @Body() input: CreateBookingDto) {
    return this.bookings.create(req.user.businessId, input);
  }

  @Get(':id')
  get(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.get(req.user.businessId, id);
  }

  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN')
  update(@Req() req: TenantRequest, @Param('id') id: string, @Body() input: UpdateBookingDto) {
    return this.bookings.update(req.user.businessId, id, input);
  }

  @Delete(':id') @UseGuards(RolesGuard) @Roles('ADMIN')
  remove(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.remove(req.user.businessId, id);
  }

  @Post(':id/check-in') @UseGuards(RolesGuard) @Roles('ADMIN')
  checkIn(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CHECKED_IN);
  }

  @Post(':id/confirm') @UseGuards(RolesGuard) @Roles('ADMIN')
  confirm(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CONFIRMED);
  }

  @Post(':id/check-out') @UseGuards(RolesGuard) @Roles('ADMIN')
  checkOut(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CHECKED_OUT);
  }

  @Post(':id/cancel') @UseGuards(RolesGuard) @Roles('ADMIN')
  cancel(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CANCELLED);
  }

  @Post(':id/no-show') @UseGuards(RolesGuard) @Roles('ADMIN')
  noShow(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.NO_SHOW);
  }
}
