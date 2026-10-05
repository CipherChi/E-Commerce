import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument = require('pdfkit');
import { formatReceiptMoney } from '@hotel/shared-types/src/money.js';
import { PrismaService } from '../prisma/prisma.service';

const receiptInclude = {
  business: true,
  createdBy: { select: { name: true } },
  customer: { select: { name: true, phone: true } },
  items: { include: { product: { select: { name: true } } } },
} satisfies Prisma.SaleInclude;
type ReceiptSale = Prisma.SaleGetPayload<{ include: typeof receiptInclude }>;

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async tenantReceipt(businessId: string, saleId: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id: saleId, businessId, status: 'COMPLETED' }, include: receiptInclude });
    if (!sale) throw new NotFoundException('Receipt not found');
    return this.toReceipt(sale);
  }

  async publicReceipt(token: string) {
    const sale = await this.prisma.sale.findFirst({ where: { receiptToken: token, status: 'COMPLETED' }, include: receiptInclude });
    if (!sale) throw new NotFoundException('Receipt not found');
    return this.toReceipt(sale);
  }

  async pdf(token: string): Promise<{ receiptNumber: string; buffer: Buffer }> {
    const receipt = await this.publicReceipt(token);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(Buffer.from(chunk)));
      doc.on('error', reject);
      doc.on('end', () => resolve({ receiptNumber: receipt.receiptNumber ?? 'receipt', buffer: Buffer.concat(chunks) }));
      const logo = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(receipt.business.logoUrl ?? '');
      if (logo) {
        doc.image(Buffer.from(logo[2], 'base64'), 48, 48, { fit: [56, 48] });
        doc.fontSize(19).font('Helvetica-Bold').text(receipt.business.name, 116, 48);
        doc.fontSize(10).font('Helvetica').text([receipt.business.address, receipt.business.phone].filter(Boolean).join(' · '), 116, 74);
        doc.y = 124;
      } else {
        doc.fontSize(19).font('Helvetica-Bold').text(receipt.business.name);
        doc.fontSize(10).font('Helvetica').text([receipt.business.address, receipt.business.phone].filter(Boolean).join(' · '));
      }
      doc.moveDown().fontSize(16).font('Helvetica-Bold').text(`Receipt ${receipt.receiptNumber}`);
      doc.fontSize(10).font('Helvetica').text(new Date(receipt.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }));
      doc.text(`Customer: ${receipt.customer.name}${receipt.customer.phone ? ` · ${receipt.customer.phone}` : ''}`);
      doc.text(`Cashier: ${receipt.recordedBy}`);
      doc.moveDown().moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown(0.5);
      for (const item of receipt.items) {
        doc.text(`${item.name}  (${item.quantity} x ${formatReceiptMoney(String(item.unitPrice))})`, { continued: true });
        doc.text(formatReceiptMoney(String(item.lineSubtotal)), { align: 'right' });
      }
      doc.moveDown().moveTo(48, doc.y).lineTo(547, doc.y).stroke();
      doc.moveDown().text(`Subtotal: ${formatReceiptMoney(String(receipt.subtotal))}`, { align: 'right' });
      doc.font('Helvetica-Bold').text(`Total: ${formatReceiptMoney(String(receipt.total))}`, { align: 'right' });
      doc.font('Helvetica').text(`Payment: ${receipt.paymentMethod} · ${receipt.paymentStatus}`, { align: 'right' });
      doc.text(`Paid: ${formatReceiptMoney(String(receipt.amountPaid))}`, { align: 'right' });
      doc.text(`Balance: ${formatReceiptMoney(String(receipt.balance))}`, { align: 'right' });
      doc.end();
    });
  }

  private toReceipt(sale: ReceiptSale) {
    return {
      saleId: sale.id,
      recordedBy: sale.createdBy.name,
      business: { name: sale.business.name, address: sale.business.address, phone: sale.business.phone, logoUrl: sale.business.logo },
      receiptNumber: sale.receiptNumber,
      publicUrl: `${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/public/receipt/${sale.receiptToken}`,
      pdfUrl: `${process.env.API_ORIGIN ?? 'http://localhost:3001'}/receipts/public/${sale.receiptToken}/pdf`,
      createdAt: sale.createdAt,
      customer: sale.customer ?? { name: sale.guestName ?? 'Guest', phone: null },
      items: sale.items.map(item => ({ name: item.product.name, quantity: item.quantity, unitPrice: item.unitPrice, lineSubtotal: item.lineSubtotal })),
      subtotal: sale.subtotal,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      amountPaid: sale.amountPaid,
      balance: Prisma.Decimal.max(new Prisma.Decimal(0), sale.total.minus(sale.amountPaid)),
    };
  }
}
