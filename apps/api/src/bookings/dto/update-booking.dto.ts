import { BookingSource, BookingStatus } from '@prisma/client';


export class UpdateBookingDto {
    status?: BookingStatus;
     roomId?: string;
     customerId?: string;
    checkIn?: string;
    checkOut?: string;
    source?: BookingSource;
}
