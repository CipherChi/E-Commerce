

import { Request } from 'express';


import { TenantRecordsService } from './tenant-records.service';







export class TenantRecordsController {
  constructor(private readonly records: TenantRecordsService) {}




  getPayment( req: Request & { user: { businessId: string } },  id: string) {
    return this.records.get('payment', req.user.businessId, id);
  }

  updatePayment(
     req: Request & { user: { businessId: string } },
     id: string,
     body: Record<string, unknown>,
  ) {
    return this.records.update('payment', req.user.businessId, id, body);
  }

  removePayment( req: Request & { user: { businessId: string } },  id: string) {
    return this.records.remove('payment', req.user.businessId, id);
  }

  updateInvoice(
     req: Request & { user: { businessId: string } },
     id: string,
     body: Record<string, unknown>,
  ) {
    return this.records.update('invoice', req.user.businessId, id, body);
  }

  removeInvoice( req: Request & { user: { businessId: string } },  id: string) {
    return this.records.remove('invoice', req.user.businessId, id);
  }
}
