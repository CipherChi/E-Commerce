import { BusinessType } from '@prisma/client';

export class RegisterDto {
    email!: string;
    password!: string;
     name!: string;
   primaryType!: BusinessType;
}
