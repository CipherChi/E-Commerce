import {
  BookingSource, BookingStatus, BusinessModuleType, BusinessType, PaymentMethod, PropertyType,
  RoomStatus, SalePaymentStatus,
} from '@prisma/client';
import { z } from 'zod';

const decimal = z.string().regex(/^\d+(\.\d{1,2})?$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);
const page = z.preprocess((value) => value === undefined ? 1 : Number(value), z.number().int().min(1));
const sizedPage = (fallback: number) => z.preprocess((value) => value === undefined ? fallback : Number(value), z.number().int().min(1).max(100));
const boolTransform = z.preprocess((value) => typeof value === 'string' ? Boolean(value) : value, z.boolean());
const optionalText = (max: number) => z.string().max(max).optional();
const positiveInteger = z.preprocess((value) => Number(value), z.number().int().min(1));
const body = (shape: z.ZodRawShape) => z.object(shape).strict();

export const apiValidation: Record<string, { body?: z.ZodTypeAny; query?: z.ZodTypeAny }> = {
  'POST /businesses': { body: body({ name: z.string().min(1).max(200), primaryType: z.nativeEnum(BusinessType), phone: z.string().max(50).optional(), address: z.string().max(500).optional(), logo: z.string().url().max(2048).refine((v) => v.startsWith('https://')).optional() }) },
  'PATCH /businesses/modules': { body: body({ module: z.nativeEnum(BusinessModuleType), isEnabled: z.boolean() }) },
  'POST /businesses/staff': { body: body({ name: z.string().max(200), email: z.string().email().max(254), password: z.string().min(8) }) },
  'PATCH /businesses/staff/:userId': { body: body({ isActive: z.boolean() }) },
  'POST /properties': { body: body({ name: z.string().min(1).max(200), address: z.string().min(1).max(500), type: z.nativeEnum(PropertyType).optional() }) },
  'PATCH /properties/:id': { body: body({ name: z.string().min(1).max(200).optional(), address: z.string().min(1).max(500).optional(), type: z.nativeEnum(PropertyType).optional() }) },
  'POST /properties/:propertyId/rooms': { body: body({ label: z.string().min(1).max(200), type: z.string().min(1).max(100), capacity: positiveInteger, basePrice: decimal, status: z.nativeEnum(RoomStatus).optional() }) },
  'PATCH /properties/:propertyId/rooms/:roomId': { body: body({ label: z.string().min(1).max(200).optional(), type: z.string().min(1).max(100).optional(), capacity: positiveInteger.optional(), basePrice: decimal.optional(), status: z.nativeEnum(RoomStatus).optional() }) },
  'POST /customers': { body: body({ name: z.string().min(1).max(200), phone: z.string().min(3).max(50), email: z.string().email().max(254).optional(), idType: optionalText(100), idNumber: optionalText(100), notes: optionalText(2000) }) },
  'PATCH /customers/:id': { body: body({ name: z.string().min(1).max(200).optional(), phone: z.string().min(3).max(50).optional(), email: z.string().email().max(254).optional(), idType: optionalText(100), idNumber: optionalText(100), notes: optionalText(2000) }) },
  'GET /customers': { query: body({ q: z.string().max(200).optional(), page, pageSize: sizedPage(25) }) },
  'POST /catalog': { body: body({ name: z.string().max(200), module: z.nativeEnum(BusinessModuleType), category: optionalText(200), costPrice: decimal.optional(), sellingPrice: decimal.optional(), normalRate: decimal.optional(), partyRate: decimal.optional(), monthlyPrice: decimal.optional(), isStockable: boolTransform.optional(), lowStockThreshold: z.preprocess((v) => v === undefined ? undefined : Number(v), z.number().int().min(0)).optional() }) },
  'PATCH /catalog/:id': { body: body({ name: z.string().max(200).optional(), module: z.nativeEnum(BusinessModuleType).optional(), category: optionalText(200), costPrice: decimal.optional(), sellingPrice: decimal.optional(), normalRate: decimal.optional(), partyRate: decimal.optional(), monthlyPrice: decimal.optional(), isStockable: boolTransform.optional(), lowStockThreshold: z.preprocess((v) => Number(v), z.number().int().min(0)).optional() }) },
  'GET /catalog': { query: body({ module: z.nativeEnum(BusinessModuleType).optional(), category: z.string().max(200).optional(), is_stockable: z.string().optional(), is_archived: z.string().optional(), q: z.string().max(200).optional(), page, pageSize: sizedPage(25) }) },
  'POST /inventory/stock-in': { body: body({ productId: z.string(), quantity: positiveInteger, reason: optionalText(2000) }) },
  'POST /inventory/stock-out': { body: body({ productId: z.string(), quantity: positiveInteger, reason: optionalText(2000) }) },
  'POST /inventory/adjustments': { body: body({ productId: z.string(), quantity: z.preprocess((v) => Number(v), z.number().int()), reason: z.string().max(2000) }) },
  'GET /inventory/:productId/movements': { query: body({ type: z.string().optional(), from: date.optional(), to: date.optional(), page, limit: z.preprocess((v) => v === undefined ? 20 : Number(v), z.number().int().min(1)) }) },
  'POST /sales': { body: body({ customerId: z.string().optional(), guestName: z.string().max(200).optional(), paymentMethod: z.nativeEnum(PaymentMethod), paymentStatus: z.nativeEnum(SalePaymentStatus), amountPaid: decimal.optional(), items: z.array(body({ productId: z.string(), quantity: positiveInteger, pricingOption: z.enum(['NORMAL', 'PARTY']).optional() })).min(1) }) },
  'GET /sales': { query: body({ from: z.string().optional(), to: z.string().optional(), customerId: z.string().optional(), paymentMethod: z.string().optional(), status: z.string().optional(), paymentStatus: z.string().optional(), recordedById: z.string().optional(), q: z.string().max(200).optional(), page, pageSize: sizedPage(25) }) },
  'POST /expenses/categories': { body: body({ name: z.string().min(1).max(200) }) },
  'PATCH /expenses/categories/:id': { body: body({ name: z.string().min(1).max(200) }) },
  'POST /expenses': { body: body({ categoryId: z.string(), amount: decimal, description: optionalText(2000), expenseDate: z.string().datetime().or(date) }) },
  'PATCH /expenses/:id': { body: body({ categoryId: z.string(), amount: decimal, description: optionalText(2000), expenseDate: z.string().datetime().or(date) }) },
  'POST /bookings': { body: body({ roomId: z.string().min(1), customerId: z.string().min(1), checkIn: date, checkOut: date, source: z.nativeEnum(BookingSource).optional() }) },
  'PATCH /bookings/:id': { body: body({ status: z.nativeEnum(BookingStatus).optional(), roomId: z.string().min(1).optional(), customerId: z.string().min(1).optional(), checkIn: date.optional(), checkOut: date.optional(), source: z.nativeEnum(BookingSource).optional() }) },
  'GET /bookings': { query: body({ from: date.optional(), to: date.optional(), status: z.nativeEnum(BookingStatus).optional(), roomId: z.string().optional(), customerId: z.string().optional(), page, pageSize: sizedPage(20) }) },
  'POST /bookings/:bookingId/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText(200) }) },
  'POST /invoices/:id/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText(200) }) },
};

export function applyApiValidation(method: string, path: string, request: { body: unknown; query: unknown }) {
  const schema = apiValidation[`${method.toUpperCase()} ${path}`];
  if (!schema) return;
  if (schema.body) request.body = schema.body.parse(request.body);
  if (schema.query) request.query = schema.query.parse(request.query);
}

export function apiValidationMiddleware() {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const actualPath = req.path;
    const key = Object.keys(apiValidation).find((entry) => {
      const [method, template] = entry.split(' ');
      if (method !== req.method) return false;
      const pattern = new RegExp(`^${template.split('/').map((part) => part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')}/?$`);
      return pattern.test(actualPath);
    });
    if (!key) return next();
    const [method, template] = key.split(' ');
    try {
      const parsed: { body: unknown; query: unknown } = { body: req.body, query: req.query };
      applyApiValidation(method, template, parsed);
      if (apiValidation[key].body) req.body = parsed.body;
      if (apiValidation[key].query) Object.defineProperty(req, 'query', { configurable: true, value: parsed.query });
      next();
    } catch (error) { next(error); }
  };
}
