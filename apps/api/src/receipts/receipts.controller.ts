

import { Request, Response } from 'express';


import { ReceiptsService } from './receipts.service';


type TenantRequest = Request & { user: { businessId: string } };



export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}




  async publicPdf( token: string,  response: Response) {
    const result = await this.receipts.pdf(token);
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${result.receiptNumber}.pdf"` });
    response.send(result.buffer);
  }




  publicGet( token: string) { return this.receipts.publicReceipt(token); }




  get( req: TenantRequest,  id: string) {
    return this.receipts.tenantReceipt(req.user.businessId, id);
  }
}
