
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {

  amount!: string;
   method!: PaymentMethod;
     reference?: string;
}
