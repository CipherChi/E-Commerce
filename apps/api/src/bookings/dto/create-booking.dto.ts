import { BookingSource } from '@prisma/client';


export class CreateBookingDto {
    roomId!: string;
    customerId!: string;
   checkIn!: string;
   checkOut!: string;
    source?: BookingSource;
}
