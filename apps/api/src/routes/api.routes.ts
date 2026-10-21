import { Express, Request, RequestHandler, Response, Router } from 'express';
import { ApiContainer } from '../lib/container';
import { authenticate, requireBusinessContext, requireRole } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { rateLimit } from '../middleware/rate-limit';
import { applyApiValidation } from '../validation/api.schemas';
import { captureRouteTemplate } from '../middleware/request-logger';

type AnyController = Record<string, (...args: never[]) => unknown>;
type Req = Request & { user?: { sub?: string; businessId?: string; role?: string | null } };
type Args = (req: Request, res: Response) => unknown[];

function handler(controller: AnyController, method: string, args: Args, status: number, fullPath: string): RequestHandler {
  return asyncHandler(async (req, res) => {
    const parsed: { body: unknown; query: unknown } = { body: req.body, query: req.query };
    const validationPath = fullPath.length > 1 ? fullPath.replace(/\/$/, '') : fullPath;
    applyApiValidation(req.method, validationPath, parsed);
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) Object.defineProperty(req, 'query', { configurable: true, value: parsed.query });
    const result = await controller[method](...args(req, res) as never[]);
    if (!res.headersSent) {
      if (result === undefined) res.status(status).end();
      else res.status(status).json(result);
    }
  });
}

let currentPrefix = '';
function register(router: Router, verb: 'get' | 'post' | 'patch' | 'delete', path: string, c: AnyController, method: string, args: Args = (req) => [req], policy: 'public' | 'jwt' | 'business' | 'admin' = 'business', status = verb === 'post' ? 201 : 200) {
  const guards: RequestHandler[] = policy === 'public' ? [] : policy === 'jwt' ? [authMiddleware] : policy === 'admin' ? [authMiddleware, requireBusinessContext, requireRole('ADMIN')] : [authMiddleware, requireBusinessContext];
  router[verb](path, captureRouteTemplate, ...guards, handler(c, method, args, status, `${currentPrefix}${path}`));
}

let authMiddleware: RequestHandler;
function requestArgs(...extractors: Array<(req: Req, res: Response) => unknown>) {
  return (req: Request, res: Response) => extractors.map((extract) => extract(req as Req, res));
}
const req = (r: Req) => r;
const body = (r: Req) => r.body;
const query = (r: Req) => r.query;
const param = (name: string) => (r: Req) => r.params[name];
const headers = (name: string) => (r: Req) => r.headers[name.toLowerCase()];
const response = (_r: Req, res: Response) => res;

export function mountApiRoutes(app: Express, container: ApiContainer, accessSecret: string, redisUrl?: string) {
  authMiddleware = authenticate(container.jwt, container.prisma, accessSecret);
  const c = container.controllers as unknown as Record<string, AnyController>;

  const businesses = Router();
  currentPrefix = '/businesses';
  register(businesses, 'post', '/', c.businesses, 'create', requestArgs(req, body), 'jwt');
  register(businesses, 'get', '/profile', c.businesses, 'profile');
  register(businesses, 'get', '/modules', c.businesses, 'modules');
  register(businesses, 'patch', '/modules', c.businesses, 'setModule', requestArgs(req, body), 'admin');
  register(businesses, 'get', '/staff', c.businesses, 'staff', undefined, 'admin');
  register(businesses, 'post', '/staff', c.businesses, 'createStaff', requestArgs(req, body), 'admin');
  register(businesses, 'patch', '/staff/:userId', c.businesses, 'setStaffActive', requestArgs(req, param('userId'), body), 'admin');
  app.use('/businesses', businesses);

  const properties = Router();
  currentPrefix = '/properties';
  register(properties, 'get', '/', c.properties, 'list'); register(properties, 'get', '/:id', c.properties, 'get', requestArgs(req, param('id')));
  register(properties, 'post', '/', c.properties, 'create', requestArgs(req, body), 'admin');
  register(properties, 'patch', '/:id', c.properties, 'update', requestArgs(req, param('id'), body), 'admin');
  register(properties, 'delete', '/:id', c.properties, 'remove', requestArgs(req, param('id')), 'admin'); app.use('/properties', properties);

  const rooms = Router();
  currentPrefix = '/properties';
  register(rooms, 'get', '/:propertyId/rooms', c.rooms, 'list', requestArgs(req, param('propertyId')));
  register(rooms, 'get', '/:propertyId/rooms/:roomId', c.rooms, 'get', requestArgs(req, param('propertyId'), param('roomId')));
  register(rooms, 'post', '/:propertyId/rooms', c.rooms, 'create', requestArgs(req, param('propertyId'), body), 'admin');
  register(rooms, 'patch', '/:propertyId/rooms/:roomId', c.rooms, 'update', requestArgs(req, param('propertyId'), param('roomId'), body), 'admin');
  register(rooms, 'delete', '/:propertyId/rooms/:roomId', c.rooms, 'remove', requestArgs(req, param('propertyId'), param('roomId')), 'admin'); app.use('/properties', rooms);

  const customers = Router();
  currentPrefix = '/customers';
  register(customers, 'get', '/', c.customers, 'list', requestArgs(req, query)); register(customers, 'get', '/:id', c.customers, 'get', requestArgs(req, param('id')));
  register(customers, 'post', '/', c.customers, 'create', requestArgs(req, body)); register(customers, 'patch', '/:id', c.customers, 'update', requestArgs(req, param('id'), body), 'admin');
  register(customers, 'delete', '/:id', c.customers, 'remove', requestArgs(req, param('id')), 'admin'); app.use('/customers', customers);

  const catalog = Router();
  currentPrefix = '/catalog';
  register(catalog, 'get', '/', c.catalog, 'list', requestArgs(req, query)); register(catalog, 'get', '/categories', c.catalog, 'categories');
  register(catalog, 'post', '/', c.catalog, 'create', requestArgs(req, body), 'admin'); register(catalog, 'get', '/:id', c.catalog, 'get', requestArgs(req, param('id')));
  register(catalog, 'patch', '/:id', c.catalog, 'update', requestArgs(req, param('id'), body), 'admin'); register(catalog, 'post', '/:id/archive', c.catalog, 'archive', requestArgs(req, param('id')), 'admin'); app.use('/catalog', catalog);

  const inventory = Router();
  currentPrefix = '/inventory';
  register(inventory, 'get', '/products', c.inventory, 'products', undefined, 'admin'); register(inventory, 'get', '/summary', c.inventory, 'summary', undefined, 'admin');
  register(inventory, 'get', '/low-stock', c.inventory, 'low', undefined, 'admin'); register(inventory, 'get', '/:productId/current', c.inventory, 'current', requestArgs(req, param('productId')), 'admin');
  register(inventory, 'get', '/:productId/movements', c.inventory, 'history', requestArgs(req, param('productId'), query), 'admin');
  register(inventory, 'post', '/stock-in', c.inventory, 'stockIn', requestArgs(req, body), 'admin'); register(inventory, 'post', '/stock-out', c.inventory, 'stockOut', requestArgs(req, body), 'admin');
  register(inventory, 'post', '/adjustments', c.inventory, 'adjust', requestArgs(req, body), 'admin'); app.use('/inventory', inventory);

  const sales = Router();
  currentPrefix = '/sales';
  register(sales, 'get', '/', c.sales, 'list', requestArgs(req, query)); register(sales, 'get', '/:id', c.sales, 'get', requestArgs(req, param('id')));
  register(sales, 'post', '/', c.sales, 'create', requestArgs(req, body, headers('idempotency-key'))); app.use('/sales', sales);

  const expenses = Router();
  currentPrefix = '/expenses';
  register(expenses, 'get', '/categories', c.expenses, 'categories', undefined, 'admin'); register(expenses, 'post', '/categories', c.expenses, 'createCat', requestArgs(req, body), 'admin');
  register(expenses, 'patch', '/categories/:id', c.expenses, 'updateCat', requestArgs(req, param('id'), body), 'admin'); register(expenses, 'delete', '/categories/:id', c.expenses, 'archiveCat', requestArgs(req, param('id')), 'admin');
  register(expenses, 'get', '/summary', c.expenses, 'summary', requestArgs(req, (r) => r.query.from, (r) => r.query.to), 'admin');
  register(expenses, 'get', '/', c.expenses, 'list', requestArgs(req, (r) => r.query.categoryId, (r) => r.query.from, (r) => r.query.to, (r) => r.query.archived), 'admin');
  register(expenses, 'post', '/', c.expenses, 'create', requestArgs(req, body), 'admin'); register(expenses, 'patch', '/:id', c.expenses, 'update', requestArgs(req, param('id'), body), 'admin');
  register(expenses, 'delete', '/:id', c.expenses, 'archive', requestArgs(req, param('id')), 'admin'); app.use('/expenses', expenses);

  const dashboard = Router(); currentPrefix = '/dashboard'; register(dashboard, 'get', '/summary', c.dashboard, 'summary', requestArgs(req, (r) => r.query.range, (r) => r.query.from, (r) => r.query.to, (r) => r.query.date)); app.use('/dashboard', dashboard);

  const receipts = Router();
  currentPrefix = '/receipts';
  receipts.get('/public/:token/pdf', captureRouteTemplate, rateLimit(20, 60_000, redisUrl, 'receipt:pdf'), asyncHandler(async (req, res) => c.receipts.publicPdf(...[req.params.token, res] as never[])));
  receipts.get('/public/:token', captureRouteTemplate, rateLimit(20, 60_000, redisUrl, 'receipt:public'), handler(c.receipts, 'publicGet', requestArgs(param('token')), 200, '/receipts/public/:token'));
  register(receipts, 'get', '/:saleId', c.receipts, 'get', requestArgs(req, param('saleId'))); app.use('/receipts', receipts);

  const bookings = Router();
  currentPrefix = '/bookings';
  register(bookings, 'get', '/', c.bookings, 'list', requestArgs(req, query));
  register(bookings, 'get', '/availability', c.bookings, 'availability', requestArgs(req, (r) => r.query.roomId, (r) => r.query.checkIn, (r) => r.query.checkOut));
  register(bookings, 'post', '/', c.bookings, 'create', requestArgs(req, body)); register(bookings, 'get', '/:id', c.bookings, 'get', requestArgs(req, param('id')));
  register(bookings, 'patch', '/:id', c.bookings, 'update', requestArgs(req, param('id'), body), 'admin'); register(bookings, 'delete', '/:id', c.bookings, 'remove', requestArgs(req, param('id')), 'admin');
  for (const [suffix, method] of [['check-in', 'checkIn'], ['confirm', 'confirm'], ['check-out', 'checkOut'], ['cancel', 'cancel'], ['no-show', 'noShow']] as const) register(bookings, 'post', `/:id/${suffix}`, c.bookings, method, requestArgs(req, param('id')), 'admin');
  app.use('/bookings', bookings);

  const payments = Router();
  currentPrefix = '';
  register(payments, 'post', '/bookings/:bookingId/invoice', c.payments, 'createInvoice', requestArgs(req, param('bookingId')), 'admin');
  register(payments, 'post', '/bookings/:bookingId/payments', c.payments, 'recordForBooking', requestArgs(req, param('bookingId'), body), 'admin');
  register(payments, 'get', '/invoices/:id', c.payments, 'invoice', requestArgs(req, param('id')), 'admin');
  register(payments, 'get', '/invoices/:id/payments', c.payments, 'list', requestArgs(req, param('id')), 'admin');
  register(payments, 'post', '/invoices/:id/void', c.payments, 'void', requestArgs(req, param('id')), 'admin');
  register(payments, 'post', '/invoices/:id/payments', c.payments, 'record', requestArgs(req, param('id'), body), 'admin'); app.use('/', payments);

  const tenantRecords = Router();
  currentPrefix = '';
  register(tenantRecords, 'get', '/payments/:id', c.tenantRecords, 'getPayment', requestArgs(req, param('id')), 'admin');
  register(tenantRecords, 'patch', '/payments/:id', c.tenantRecords, 'updatePayment', requestArgs(req, param('id'), body));
  register(tenantRecords, 'delete', '/payments/:id', c.tenantRecords, 'removePayment', requestArgs(req, param('id')));
  register(tenantRecords, 'patch', '/invoices/:id', c.tenantRecords, 'updateInvoice', requestArgs(req, param('id'), body));
  register(tenantRecords, 'delete', '/invoices/:id', c.tenantRecords, 'removeInvoice', requestArgs(req, param('id'))); app.use('/', tenantRecords);

  const activity = Router(); currentPrefix = '/activity'; register(activity, 'get', '/', c.activity, 'list'); app.use('/activity', activity);
}
