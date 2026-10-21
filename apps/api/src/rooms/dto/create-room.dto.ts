
import { RoomStatus } from '@prisma/client';



export class CreateRoomDto {
     label!: string;
     type!: string;
     capacity!: number;
    basePrice!: string;



  status?: RoomStatus;
}
