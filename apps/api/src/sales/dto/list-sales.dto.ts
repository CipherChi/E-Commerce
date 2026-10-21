


export class ListSalesDto {
    from?: string;
    to?: string;
    customerId?: string;
    paymentMethod?: string;
    status?: string;
    paymentStatus?: string;
    recordedById?: string;
     q?: string;
      page = 1;
       pageSize = 25;
}
