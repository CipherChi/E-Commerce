

import { Request } from 'express';




import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
type TenantRequest = Request & { user: { businessId: string; sub: string } };

export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
     createInvoice( req: TenantRequest,  id: string) { return this.payments.createInvoice(req.user.businessId, id); }
     recordForBooking( req: TenantRequest,  id: string,  dto: RecordPaymentDto) { return this.payments.recordBookingPayment(req.user.businessId, req.user.sub, id, dto); }
     invoice( req: TenantRequest,  id: string) { return this.payments.invoice(req.user.businessId, id); }
     list( req: TenantRequest,  id: string) { return this.payments.listForInvoice(req.user.businessId, id); }
     void( req: TenantRequest,  id: string) { return this.payments.voidInvoice(req.user.businessId, id); }
     record( req: TenantRequest,  id: string,  dto: RecordPaymentDto) { return this.payments.recordPayment(req.user.businessId, req.user.sub, id, dto); }
}
