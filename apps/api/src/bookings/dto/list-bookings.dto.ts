import { BookingStatus } from '@prisma/client';



export class ListBookingsDto {
    from?: string;
    to?: string;
    status?: BookingStatus;
    roomId?: string;
    customerId?: string;
      page = 1;
       pageSize = 20;
}
