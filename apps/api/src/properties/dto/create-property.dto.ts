
import { PropertyType } from '@prisma/client';


export class CreatePropertyDto {
     name!: string;
     address!: string;



  type?: PropertyType;
}
