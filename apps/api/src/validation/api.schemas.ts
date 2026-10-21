import {
  BookingSource, BookingStatus, BusinessModuleType, BusinessType, PaymentMethod, PropertyType,
  RoomStatus, SalePaymentStatus,
} from '@prisma/client';
import validator = require('validator');
import { z } from 'zod';

const decimal = z.string().regex(/^\d+(\.\d{1,2})?$/);
// Mirrors IsOptional: class-validator skips both undefined and null.
const optional = (schema: z.ZodTypeAny) => schema.nullable().optional();
const optionalText = () => optional(z.string());
const body = (shape: z.ZodRawShape) => z.object(shape).strict();
const email = z.string().refine(validator.isEmail, 'must be an email');
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

const date = z.string().refine(validator.isISO8601, 'must be a valid ISO 8601 date string');
const strictDate = z.string().refine((value) => validator.isISO8601(value, { strict: true }), 'must be a strict ISO 8601 date string');

export const apiValidation: Record<string, { body?: z.ZodTypeAny; query?: z.ZodTypeAny }> = {
  'POST /businesses': { body: body({ name: z.string().min(1), primaryType: z.nativeEnum(BusinessType), phone: optionalText(), address: optionalText(), logo: optionalText() }) },
  'PATCH /businesses/modules': { body: body({ module: z.nativeEnum(BusinessModuleType), isEnabled: z.boolean() }) },
  'POST /businesses/staff': { body: body({ name: z.string(), email, password: z.string().min(8) }) },
  // The original inline object parameter has no class-validator metatype, so ValidationPipe did not validate it.
  'POST /properties': { body: body({ name: z.string().min(1), address: z.string().min(1), type: optional(z.nativeEnum(PropertyType)) }) },
  'PATCH /properties/:id': { body: body({ name: optional(z.string().min(1)), address: optional(z.string().min(1)), type: optional(z.nativeEnum(PropertyType)) }) },
  'POST /properties/:propertyId/rooms': { body: body({ label: z.string().min(1), type: z.string().min(1), capacity: positiveInteger, basePrice: decimal, status: optional(z.nativeEnum(RoomStatus)) }) },
  'PATCH /properties/:propertyId/rooms/:roomId': { body: body({ label: optional(z.string().min(1)), type: optional(z.string().min(1)), capacity: optional(positiveInteger), basePrice: optional(decimal), status: optional(z.nativeEnum(RoomStatus)) }) },
  'POST /customers': { body: body({ name: z.string().min(1), phone: z.string().min(3), email: optional(email), idType: optionalText(), idNumber: optionalText(), notes: optionalText() }) },
  'PATCH /customers/:id': { body: body({ name: optional(z.string().min(1)), phone: optional(z.string().min(3)), email: optional(email), idType: optionalText(), idNumber: optionalText(), notes: optionalText() }) },
  'GET /customers': { query: body({ q: optionalText(), page, pageSize: sizedPage(25) }) },
  'POST /catalog': { body: body({ name: z.string(), module: z.nativeEnum(BusinessModuleType), category: optionalText(), costPrice: optional(decimal), sellingPrice: optional(decimal), normalRate: optional(decimal), partyRate: optional(decimal), monthlyPrice: optional(decimal), isStockable: optional(boolTransform), lowStockThreshold: optional(nonNegativeInteger) }) },
  'PATCH /catalog/:id': { body: body({ name: optionalText(), module: optional(z.nativeEnum(BusinessModuleType)), category: optionalText(), costPrice: optional(decimal), sellingPrice: optional(decimal), normalRate: optional(decimal), partyRate: optional(decimal), monthlyPrice: optional(decimal), isStockable: optional(boolTransform), lowStockThreshold: optional(nonNegativeInteger) }) },
  'GET /catalog': { query: body({ module: optional(z.nativeEnum(BusinessModuleType)), category: optionalText(), is_stockable: optionalText(), is_archived: optionalText(), q: optionalText(), page, pageSize: sizedPage(25) }) },
  'POST /inventory/stock-in': { body: body({ productId: z.string(), quantity: positiveInteger, reason: optionalText() }) },
  'POST /inventory/stock-out': { body: body({ productId: z.string(), quantity: positiveInteger, reason: optionalText() }) },
  'POST /inventory/adjustments': { body: body({ productId: z.string(), quantity: integer, reason: z.string() }) },
  'GET /inventory/:productId/movements': { query: body({ type: optionalText(), from: optional(date), to: optional(date), page, limit: z.preprocess((value) => value === undefined ? 20 : value === null ? null : Number(value), z.number().int().min(1).nullable()) }) },
  'POST /sales': { body: body({ customerId: optionalText(), guestName: optionalText(), paymentMethod: z.nativeEnum(PaymentMethod), paymentStatus: z.nativeEnum(SalePaymentStatus), amountPaid: optional(decimal), items: z.array(body({ productId: z.string(), quantity: positiveInteger, pricingOption: optional(z.enum(['NORMAL', 'PARTY'])) })).min(1) }) },
  'GET /sales': { query: body({ from: optionalText(), to: optionalText(), customerId: optionalText(), paymentMethod: optionalText(), status: optionalText(), paymentStatus: optionalText(), recordedById: optionalText(), q: optionalText(), page, pageSize: sizedPage(25) }) },
  'POST /expenses/categories': { body: body({ name: z.string().min(1) }) },
  'PATCH /expenses/categories/:id': { body: body({ name: z.string().min(1) }) },
  'POST /expenses': { body: body({ categoryId: z.string(), amount: decimal, description: optionalText(), expenseDate: date }) },
  'PATCH /expenses/:id': { body: body({ categoryId: z.string(), amount: decimal, description: optionalText(), expenseDate: date }) },
  'POST /bookings': { body: body({ roomId: z.string().min(1), customerId: z.string().min(1), checkIn: strictDate, checkOut: strictDate, source: optional(z.nativeEnum(BookingSource)) }) },
  'PATCH /bookings/:id': { body: body({ status: optional(z.nativeEnum(BookingStatus)), roomId: optional(z.string().min(1)), customerId: optional(z.string().min(1)), checkIn: optional(strictDate), checkOut: optional(strictDate), source: optional(z.nativeEnum(BookingSource)) }) },
  'GET /bookings': { query: body({ from: optional(strictDate), to: optional(strictDate), status: optional(z.nativeEnum(BookingStatus)), roomId: optionalText(), customerId: optionalText(), page, pageSize: sizedPage(20) }) },
  'POST /bookings/:bookingId/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText() }) },
  'POST /invoices/:id/payments': { body: body({ amount: decimal, method: z.nativeEnum(PaymentMethod), reference: optionalText() }) },
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
