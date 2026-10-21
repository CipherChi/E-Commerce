
import { BookingStatus } from '@prisma/client';

import { Request } from 'express';




import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingsService } from './bookings.service';

type TenantRequest = Request & { user: { businessId: string } };





export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}


  list( req: TenantRequest,  query: ListBookingsDto) {
    return this.bookings.list(req.user.businessId, query);
  }


  availability(
     req: TenantRequest,
     roomId: string,
     checkIn: string,
     checkOut: string,
  ) {
    return this.bookings.availability(req.user.businessId, roomId, checkIn, checkOut);
  }


  create( req: TenantRequest,  input: CreateBookingDto) {
    return this.bookings.create(req.user.businessId, input);
  }


  get( req: TenantRequest,  id: string) {
    return this.bookings.get(req.user.businessId, id);
  }


  update( req: TenantRequest,  id: string,  input: UpdateBookingDto) {
    return this.bookings.update(req.user.businessId, id, input);
  }


  remove( req: TenantRequest,  id: string) {
    return this.bookings.remove(req.user.businessId, id);
  }


  checkIn( req: TenantRequest,  id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CHECKED_IN);
  }


  confirm( req: TenantRequest,  id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CONFIRMED);
  }


  checkOut( req: TenantRequest,  id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CHECKED_OUT);
  }


  cancel( req: TenantRequest,  id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.CANCELLED);
  }


  noShow( req: TenantRequest,  id: string) {
    return this.bookings.transition(req.user.businessId, id, BookingStatus.NO_SHOW);
  }
}
