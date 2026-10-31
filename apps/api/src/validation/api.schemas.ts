import {
  BookingSource, BookingStatus, BusinessModuleType, BusinessType, PaymentMethod, PropertyType,
  RoomStatus, SalePaymentStatus,
} from '@prisma/client';
import validator = require('validator');
import { z } from 'zod';

const decimal = z.string().max(32).regex(/^\d+(\.\d{1,2})?$/);
// Mirrors IsOptional: class-validator skips both undefined and null.
const optional = (schema: z.ZodTypeAny) => schema.nullable().optional();
const text = (max: number) => z.string().max(max);
const optionalText = (max: number) => optional(text(max));
const body = (shape: z.ZodRawShape) => z.object(shape).strict();
const email = text(254).refine(validator.isEmail, 'must be an email');
const page = z.preprocess((value) => value === undefined ? 1 : value === null ? null : Number(value), z.number().int().min(1).nullable());
const sizedPage = (fallback: number) => z.preprocess(
  (value) => value === undefined ? fallback : value === null ? null : Number(value),
  z.number().int().min(1).max(100).nullable(),
);
// class-transformer applies Number/Boolean before class-validator checks DTO fields.
const positiveInteger = z.preprocess((value) => value === null || value === undefined ? value : Number(value), z.number().int().min(1));
const integer = z.preprocess((value) => value === null || value === undefined ? value : Number(value), z.number().int());
const nonNegativeInteger = z.preprocess((value) => value === null || value === undefined ? value : Number(value), z.number().int().min(0));
const boolTransform = z.preprocess((value) => value === null || value === undefined ? value : typeof value === 'string' ? Boolean(value) : value, z.boolean());

const date = text(64).refine(validator.isISO8601, 'must be a valid ISO 8601 date string');
const strictDate = text(64).refine((value) => validator.isISO8601(value, { strict: true }), 'must be a strict ISO 8601 date string');
const logoUrl = text(2048).url().refine((value) => {
  try { return new URL(value).protocol === 'https:'; }
  catch { return false; }
}, 'logo must be an https URL');

export const apiValidation: Record<string, { body?: z.ZodTypeAny; query?: z.ZodTypeAny }> = {
  'POST /businesses': { body: body({ name: text(200).min(1), primaryType: z.nativeEnum(BusinessType), phone: optionalText(32), address: optionalText(500), logo: optional(logoUrl) }) },
  'PATCH /businesses/modules': { body: body({ module: z.nativeEnum(BusinessModuleType), isEnabled: z.boolean() }) },
  'POST /businesses/staff': { body: body({ name: text(200), email, password: z.string().min(8).max(128) }) },
  'PATCH /businesses/staff/:userId': { body: body({ isActive: z.boolean() }) },
  'POST /properties': { body: body({ name: text(200).min(1), address: text(500).min(1), type: optional(z.nativeEnum(PropertyType)) }) },
  'PATCH /properties/:id': { body: body({ name: optional(text(200).min(1)), address: optional(text(500).min(1)), type: optional(z.nativeEnum(PropertyType)) }) },
  'POST /properties/:propertyId/rooms': { body: body({ label: text(200).min(1), type: text(200).min(1), capacity: positiveInteger, basePrice: decimal, status: optional(z.nativeEnum(RoomStatus)) }) },
  'PATCH /properties/:propertyId/rooms/:roomId': { body: body({ label: optional(text(200).min(1)), type: optional(text(200).min(1)), capacity: optional(positiveInteger), basePrice: optional(decimal), status: optional(z.nativeEnum(RoomStatus)) }) },
  'POST /customers': { body: body({ name: text(200).min(1), phone: text(32).min(3), email: optional(email), idType: optionalText(64), idNumber: optionalText(64), notes: optionalText(2000) }) },
  'PATCH /customers/:id': { body: body({ name: optional(text(200).min(1)), phone: optional(text(32).min(3)), email: optional(email), idType: optionalText(64), idNumber: optionalText(64), notes: optionalText(2000) }) },
  'GET /customers': { query: body({ q: optionalText(200), page, pageSize: sizedPage(25) }) },
  'POST /catalog': { body: body({ name: text(200), module: z.nativeEnum(BusinessModuleType), category: optionalText(200), costPrice: optional(decimal), sellingPrice: optional(decimal), normalRate: optional(decimal), partyRate: optional(decimal), monthlyPrice: optional(decimal), isStockable: optional(boolTransform), lowStockThreshold: optional(nonNegativeInteger) }) },
  'PATCH /catalog/:id': { body: body({ name: optionalText(200), module: optional(z.nativeEnum(BusinessModuleType)), category: optionalText(200), costPrice: optional(decimal), sellingPrice: optional(decimal), normalRate: optional(decimal), partyRate: optional(decimal), monthlyPrice: optional(decimal), isStockable: optional(boolTransform), lowStockThreshold: optional(nonNegativeInteger) }) },
  'GET /catalog': { query: body({ module: optional(z.nativeEnum(BusinessModuleType)), category: optionalText(200), is_stockable: optionalText(64), is_archived: optionalText(64), q: optionalText(200), page, pageSize: sizedPage(25) }) },
  'POST /inventory/stock-in': { body: body({ productId: text(64), quantity: positiveInteger, reason: optionalText(2000) }) },
  'POST /inventory/stock-out': { body: body({ productId: text(64), quantity: positiveInteger, reason: optionalText(2000) }) },
  'POST /inventory/adjustments': { body: body({ productId: text(64), quantity: integer, reason: text(2000) }) },
  'GET /inventory/:productId/movements': { query: body({ type: optionalText(64), from: optional(date), to: optional(date), page, limit: z.preprocess((value) => value === undefined ? 20 : value === null ? null : Number(value), z.number().int().min(1).nullable()) }) },
  'POST /sales': { body: body({ customerId: optionalText(64), guestName: optionalText(200), paymentMethod: z.nativeEnum(PaymentMethod), paymentStatus: z.nativeEnum(SalePaymentStatus), amountPaid: optional(decimal), items: z.array(body({ productId: text(64), quantity: positiveInteger, pricingOption: optional(z.enum(['NORMAL', 'PARTY'])) })).min(1) }) },
  'GET /sales': { query: body({ from: optionalText(64), to: optionalText(64), customerId: optionalText(64), paymentMethod: optionalText(64), status: optionalText(64), paymentStatus: optionalText(64), recordedById: optionalText(64), q: optionalText(200), page, pageSize: sizedPage(25) }) },
  'POST /expenses/categories': { body: body({ name: text(200).min(1) }) },
  'PATCH /expenses/categories/:id': { body: body({ name: text(200).min(1) }) },
  'POST /expenses': { body: body({ categoryId: text(64), amount: decimal, description: optionalText(2000), expenseDate: date }) },
  'PATCH /expenses/:id': { body: body({ categoryId: text(64), amount: decimal, description: optionalText(2000), expenseDate: date }) },
  'POST /bookings': { body: body({ roomId: text(64).min(1), customerId: text(64).min(1), checkIn: strictDate, checkOut: strictDate, source: optional(z.nativeEnum(BookingSource)) }) },
  'PATCH /bookings/:id': { body: body({ status: optional(z.nativeEnum(BookingStatus)), roomId: optional(text(64).min(1)), customerId: optional(text(64).min(1)), checkIn: optional(strictDate), checkOut: optional(strictDate), source: optional(z.nativeEnum(BookingSource)) }) },
  'GET /bookings': { query: body({ from: optional(strictDate), to: optional(strictDate), status: optional(z.nativeEnum(BookingStatus)), roomId: optionalText(64), customerId: optionalText(64), page, pageSize: sizedPage(20) }) },
  'POST /bookings/:bookingId/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText(64) }) },
  'POST /invoices/:id/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText(64) }) },
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
