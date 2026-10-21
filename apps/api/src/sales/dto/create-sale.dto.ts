import { PaymentMethod, SalePaymentStatus } from '@prisma/client';


class SaleLineDto {
   productId!: string;
     quantity!: number;
    pricingOption?: 'NORMAL' | 'PARTY';
}
export class CreateSaleDto {
    customerId?: string;
     guestName?: string;
   paymentMethod!: PaymentMethod;
   paymentStatus!: SalePaymentStatus;
     amountPaid?: string;




  items!: SaleLineDto[];
}
