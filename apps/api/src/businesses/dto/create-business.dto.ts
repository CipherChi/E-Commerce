import { BusinessType } from '@prisma/client';


export class CreateBusinessDto {
     name!: string;
   primaryType!: BusinessType;
     phone?: string;
     address?: string;



  logo?: string;
}
