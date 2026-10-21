# NestJS → Express migration inventory and execution record

This document began as a pre-migration inventory. The Express implementation now exists in `apps/api`; the route table below remains the contract baseline used by `src/routes/route-parity.spec.ts`. Express 4.21.2 is retained (no major dependency upgrade) and asynchronous route handlers are wrapped by `asyncHandler`; this is the selected Express 4 alternative to Express 5's native promise rejection forwarding. Validation uses Zod 3 `.strict()` schemas.

Implementation note: the current code keeps controllers and services in feature directories (`src/<feature>`) to preserve domain boundaries and existing service/test paths; the Express composition layer is in `src/routes`, `src/middleware`, `src/validation`, and `src/lib`. Services are plain classes with explicit constructor dependencies and no Nest container. The old `/api/docs` Swagger UI is not mounted; see the API README. Core persistence and its schema/migrations, JWT signing/verification library, and Argon2 hashing remain in use.

Scope: `apps/api` only. This inventory records the original Nest controllers, services, DTOs, modules, bootstrap, Prisma schema, and tests, alongside the current Express implementation and its parity status. Paths below are relative to the API origin (there is no `/api` prefix on application routes; `/api/docs` is the Swagger UI).

## Contract inventory and route parity

Conventions: `JWT` means `JwtAuthGuard`; `BC` means `BusinessContextGuard`; `R(ADMIN)` means `RolesGuard` plus `@Roles('ADMIN')` (which accepts business membership `OWNER`). Every path parameter is an opaque string unless noted. `—` means no body/query DTO, not necessarily unchecked input. Nest defaults are **GET/PATCH/DELETE 200** and **POST 201**; the original logout had no `@HttpCode`, so it also returned 201. Unless noted, the response is the service result (commonly Prisma record/array; selected and serialized fields are determined by the service).

| Method + path | Controller.handler | Guards | DTO / input | Success response | Status |
|---|---|---|---|---|---|
| GET /health | HealthController.check → ready | — | — | `{status:'ok',database:'ok'}` after DB probe | 200 |
| GET /health/live | HealthController.live | — | — | `{status:'ok'}` | 200 |
| GET /health/ready | HealthController.ready | — | — | `{status:'ok',database:'ok'}` after `SELECT 1` | 200 |
| POST /auth/register | AuthController.register | Throttler (5/min) | RegisterDto | Original Nest body `{accessToken,refreshToken,user}` | 201 |
| POST /auth/login | AuthController.login | Throttler (5/min) | LoginDto | Original Nest body `{accessToken,refreshToken,user}` | 201 |
| POST /auth/refresh | AuthController.refresh | Throttler (5/min) | RefreshDto body | Original Nest body `{accessToken,refreshToken,user}` | 201 |
| GET /auth/me | AuthController.me | JWT | — | current profile and membership data (`AuthService.me`) | 200 |
| POST /auth/logout | AuthController.logout | JWT | — | `{success:true}` | 201 |
| POST /businesses | BusinessesController.create | JWT | CreateBusinessDto | created business/member result | 201 |
| GET /businesses/profile | BusinessesController.profile | JWT, BC | — | business profile | 200 |
| GET /businesses/modules | BusinessesController.modules | JWT, BC | — | enabled module list | 200 |
| PATCH /businesses/modules | BusinessesController.setModule | JWT, BC, R(ADMIN) | inline ModuleUpdateDto | updated module | 200 |
| GET /businesses/staff | BusinessesController.staff | JWT, BC, R(ADMIN) | — | staff list | 200 |
| POST /businesses/staff | BusinessesController.createStaff | JWT, BC, R(ADMIN) | inline CreateStaffDto | created staff/member | 201 |
| PATCH /businesses/staff/:userId | BusinessesController.setStaffActive | JWT, BC, R(ADMIN) | inline `{isActive:boolean}`; no class-validator metadata | updated staff/member | 200 |
| GET /properties | PropertiesController.list | JWT, BC | — | property array | 200 |
| GET /properties/:id | PropertiesController.get | JWT, BC | — | property | 200 |
| POST /properties | PropertiesController.create | JWT, BC, R(ADMIN) | CreatePropertyDto | created property | 201 |
| PATCH /properties/:id | PropertiesController.update | JWT, BC, R(ADMIN) | UpdatePropertyDto | updated property | 200 |
| DELETE /properties/:id | PropertiesController.remove | JWT, BC, R(ADMIN) | — | service result | 200 |
| GET /properties/:propertyId/rooms | RoomsController.list | JWT, BC, RolesGuard (no metadata, allows) | — | room array | 200 |
| GET /properties/:propertyId/rooms/:roomId | RoomsController.get | JWT, BC, RolesGuard (no metadata, allows) | — | room | 200 |
| POST /properties/:propertyId/rooms | RoomsController.create | JWT, BC, RolesGuard + R(ADMIN) | CreateRoomDto | created room | 201 |
| PATCH /properties/:propertyId/rooms/:roomId | RoomsController.update | JWT, BC, RolesGuard + R(ADMIN) | UpdateRoomDto | updated room | 200 |
| DELETE /properties/:propertyId/rooms/:roomId | RoomsController.remove | JWT, BC, RolesGuard + R(ADMIN) | — | service result | 200 |
| GET /customers | CustomersController.list | JWT, BC | ListCustomersDto query | `{data,total,page,pageSize}` | 200 |
| GET /customers/:id | CustomersController.get | JWT, BC | — | customer | 200 |
| POST /customers | CustomersController.create | JWT, BC | CreateCustomerDto | created customer | 201 |
| PATCH /customers/:id | CustomersController.update | JWT, BC, R(ADMIN) | UpdateCustomerDto | updated customer | 200 |
| DELETE /customers/:id | CustomersController.remove | JWT, BC, R(ADMIN) | — | service result | 200 |
| GET /catalog | CatalogController.list | JWT, BC | ListCatalogDto query | paginated result; `costPrice` omitted unless OWNER | 200 |
| GET /catalog/categories | CatalogController.categories | JWT, BC | — | category array | 200 |
| GET /catalog/:id | CatalogController.get | JWT, BC | — | item; `costPrice` omitted unless OWNER | 200 |
| POST /catalog | CatalogController.create | JWT, BC, R(ADMIN) | CreateCatalogItemDto | created item | 201 |
| PATCH /catalog/:id | CatalogController.update | JWT, BC, R(ADMIN) | UpdateCatalogItemDto | updated item | 200 |
| POST /catalog/:id/archive | CatalogController.archive | JWT, BC, R(ADMIN) | — | archive result | 201 |
| GET /inventory/products | InventoryController.products | JWT, BC, R(ADMIN) controller-wide | — | stockable products | 200 |
| GET /inventory/summary | InventoryController.summary | JWT, BC, R(ADMIN) controller-wide | — | inventory summary | 200 |
| GET /inventory/low-stock | InventoryController.low | JWT, BC, R(ADMIN) controller-wide | — | low-stock list | 200 |
| GET /inventory/:productId/current | InventoryController.current | JWT, BC, R(ADMIN) controller-wide | — | current quantity/balance | 200 |
| GET /inventory/:productId/movements | InventoryController.history | JWT, BC, R(ADMIN) controller-wide | MovementQueryDto query | paginated movement history | 200 |
| POST /inventory/stock-in | InventoryController.stockIn | JWT, BC, R(ADMIN) controller + method | StockMovementDto | created movement | 201 |
| POST /inventory/stock-out | InventoryController.stockOut | JWT, BC, R(ADMIN) controller + method | StockMovementDto | created movement | 201 |
| POST /inventory/adjustments | InventoryController.adjust | JWT, BC, R(ADMIN) controller + method | StockAdjustmentDto | created movement | 201 |
| GET /sales | SalesController.list | JWT, BC | ListSalesDto query | paginated sales | 200 |
| GET /sales/:id | SalesController.get | JWT, BC | — | sale detail | 200 |
| POST /sales | SalesController.create | JWT, BC | CreateSaleDto + required `Idempotency-Key` (1–128 trimmed chars) | sale; duplicate key returns prior result | 201 |
| GET /expenses/categories | ExpensesController.categories | JWT, BC, R(ADMIN) controller-wide | — | category list | 200 |
| POST /expenses/categories | ExpensesController.createCat | JWT, BC, R(ADMIN) | CategoryDto | category | 201 |
| PATCH /expenses/categories/:id | ExpensesController.updateCat | JWT, BC, R(ADMIN) | CategoryDto | category | 200 |
| DELETE /expenses/categories/:id | ExpensesController.archiveCat | JWT, BC, R(ADMIN) | — | archived category | 200 |
| GET /expenses/summary | ExpensesController.summary | JWT, BC, R(ADMIN) | `from`, `to` strings | summary | 200 |
| GET /expenses | ExpensesController.list | JWT, BC, R(ADMIN) | `categoryId`, `from`, `to`, `archived` strings | expense list | 200 |
| POST /expenses | ExpensesController.create | JWT, BC, R(ADMIN) | ExpenseDto | expense | 201 |
| PATCH /expenses/:id | ExpensesController.update | JWT, BC, R(ADMIN) | ExpenseDto | expense | 200 |
| DELETE /expenses/:id | ExpensesController.archive | JWT, BC, R(ADMIN) | — | archived expense | 200 |
| GET /dashboard/summary | DashboardController.summary | JWT, BC | `range`, `from`, `to`, `date` strings | OWNER financial summary; others receive masked financial fields and operational counters | 200 |
| GET /receipts/public/:token/pdf | ReceiptsController.publicPdf | Throttler (20/min) | — | PDF bytes; application/pdf + attachment filename | 200 |
| GET /receipts/public/:token | ReceiptsController.publicGet | Throttler (20/min) | — | receipt business/customer/items/totals + publicUrl/pdfUrl | 200 |
| GET /receipts/:saleId | ReceiptsController.get | JWT, BC | — | tenant receipt object | 200 |
| GET /bookings | BookingsController.list | JWT, BC | ListBookingsDto query | paginated `{data,total,page,pageSize}` | 200 |
| GET /bookings/availability | BookingsController.availability | JWT, BC | `roomId`, `checkIn`, `checkOut` strings | `{available:boolean,...}` | 200 |
| POST /bookings | BookingsController.create | JWT, BC | CreateBookingDto | booking with computed total | 201 |
| GET /bookings/:id | BookingsController.get | JWT, BC | — | booking | 200 |
| PATCH /bookings/:id | BookingsController.update | JWT, BC, R(ADMIN) | UpdateBookingDto | updated booking | 200 |
| DELETE /bookings/:id | BookingsController.remove | JWT, BC, R(ADMIN) | — | service result | 200 |
| POST /bookings/:id/check-in | BookingsController.checkIn | JWT, BC, R(ADMIN) | — | transitioned booking | 201 |
| POST /bookings/:id/confirm | BookingsController.confirm | JWT, BC, R(ADMIN) | — | transitioned booking | 201 |
| POST /bookings/:id/check-out | BookingsController.checkOut | JWT, BC, R(ADMIN) | — | transitioned booking | 201 |
| POST /bookings/:id/cancel | BookingsController.cancel | JWT, BC, R(ADMIN) | — | transitioned booking | 201 |
| POST /bookings/:id/no-show | BookingsController.noShow | JWT, BC, R(ADMIN) | — | transitioned booking | 201 |
| POST /bookings/:bookingId/invoice | PaymentsController.createInvoice | JWT, BC, R(ADMIN) | — | invoice with derived status/balance | 201 |
| POST /bookings/:bookingId/payments | PaymentsController.recordForBooking | JWT, BC, R(ADMIN) | RecordPaymentDto | payment result | 201 |
| GET /invoices/:id | PaymentsController.invoice | JWT, BC, R(ADMIN) | — | invoice with derived totals/status/balance | 200 |
| GET /invoices/:id/payments | PaymentsController.list | JWT, BC, R(ADMIN) | — | payment array | 200 |
| POST /invoices/:id/void | PaymentsController.void | JWT, BC, R(ADMIN) | — | voided invoice | 201 |
| POST /invoices/:id/payments | PaymentsController.record | JWT, BC, R(ADMIN) | RecordPaymentDto | payment result | 201 |
| GET /payments/:id | TenantRecordsController.getPayment | JWT, BC, R(ADMIN) | — | payment | 200 |
| PATCH /payments/:id | TenantRecordsController.updatePayment | JWT, BC | arbitrary record; service rejects with 400 today | no success under current logic | nominal 200 |
| DELETE /payments/:id | TenantRecordsController.removePayment | JWT, BC | —; service rejects with 400 today | no success under current logic | nominal 200 |
| PATCH /invoices/:id | TenantRecordsController.updateInvoice | JWT, BC | arbitrary record; service rejects with 400 today | no success under current logic | nominal 200 |
| DELETE /invoices/:id | TenantRecordsController.removeInvoice | JWT, BC | —; service rejects with 400 today | no success under current logic | nominal 200 |
| GET /activity | ActivityLogsController.list | JWT, BC | — | newest 100 tenant activity records | 200 |

No global route prefix is registered. `ADMIN` in role metadata means business membership `OWNER`, not the account-level role. Role and tenant policy are derived from the latest active membership in JWT validation.

## Request pipeline and framework behavior

- **Global middleware (`main.ts`):** `helmet()` security headers; `cookie-parser`; request ID UUID in `req.requestId` and `X-Request-Id`; CORS allows exact `WEB_ORIGIN`, credentials enabled, exposes `X-Request-Id`. Express trust proxy is configured only from `false`/`off` or a positive hop count; invalid values including `true` become false. Preserve order: trust proxy before IP-based identity, parsers before handlers, request IDs before logs/errors.
- **Guards:** `JwtAuthGuard` delegates to Passport `jwt`; bearer token only. `JwtStrategy` verifies active user and tokenVersion, resolves latest active `BusinessMember`, ignores token account role for business authorization, and rejects a user with memberships but none active. `BusinessContextGuard` returns 403 `Create or join a business first` if businessId/role absent. `RolesGuard` reads metadata; no role metadata means allow; ADMIN policy maps to OWNER membership. `OriginGuard` requires exact `Origin === WEB_ORIGIN`, else 403 `Invalid request origin`; used only refresh/logout. `ThrottlerGuard` plus route overrides: auth register/login/refresh 5 per 60s, public receipt reads 20 per 60s. Default configured limit is 5/min. If Redis URL is set, custom Redis storage is used; storage failure fails closed with 503.
- **Decorator:** `@Roles` uses SetMetadata('roles', roles); parameter decorators bind request values. Swagger decorators (`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiPropertyOptional`) are metadata only.
- **Global pipe:** `ValidationPipe({whitelist:true, transform:true, forbidNonWhitelisted:true})`. Class-validator metadata is the allow-list; extra fields reject with 400. class-transformer converts decorated numbers and nested sale lines and applies DTO defaults. `@Type(() => Boolean)` uses JS truthiness, so string `"false"` becomes true. Inputs without decorated DTOs are not equivalently constrained.
- **Interceptor:** `HttpLoggingInterceptor` logs JSON `{event:'http_request',requestId,method,path,statusCode,durationMs}` on finalize for success/error; route template or `unmatched`. It does not wrap response bodies.
- **Filter:** `HttpExceptionFilter` catches all exceptions, formats response below, logs 5xx event and stack.
- No custom Nest pipes, custom class-validator constraints, mailer, queue, scheduler, or cache module was found. `@Injectable` is DI metadata.

## DTO rules and validation parity

Zod schemas should use `.strict()` for decorated DTOs, with explicit coercion/defaults matching class-transformer. Rules found:

- `RegisterDto`: email valid; password string min 12; name string min 1; BusinessType enum `primaryType`.
- `LoginDto`: email valid; password string min 8.
- `CreateBusinessDto`: name string min 1; BusinessType enum; optional phone/address/logo are strings (no max length or URL restriction).
- Inline `ModuleUpdateDto`: BusinessModuleType enum + boolean `isEnabled`. Inline `CreateStaffDto`: name string, valid email, password min 8. Inline staff active body `{isActive:boolean}` has no validator metadata and is a known validation gap.
- `CreatePropertyDto`: name/address strings min 1, optional PropertyType enum. `UpdatePropertyDto` is Swagger `PartialType` (all optional, same rules).
- `CreateRoomDto`: label 1–200, type 1–100, capacity number integer >=1, basePrice decimal string regex `^\d+(\.\d{1,2})?$`, optional RoomStatus enum. Update is partial.
- `CreateCustomerDto`: name 1–200, phone 3–50; optional email valid max 254, idType/idNumber max 100, notes max 2000. Update partial. `ListCustomersDto`: optional q max 200; page integer >=1 default 1; pageSize integer 1–100 default 25; both query numerics transformed.
- Catalog create: name string max 200; BusinessModuleType; optional category max 200; optional costPrice/sellingPrice/normalRate/partyRate/monthlyPrice decimal strings with same regex; optional isStockable Boolean transform; lowStockThreshold number integer >=0. Update makes fields optional. `ListCatalogDto`: module enum, category max 200, is_stockable/is_archived strings, q max 200, page >=1 default 1, pageSize 1–100 default 25.
- `StockMovementDto`: productId string; quantity number integer >=1; optional reason max 2000. `StockAdjustmentDto`: productId string; quantity integer (no min); reason string max 2000 (no min). `MovementQueryDto`: optional type string; from/to date strings; page >=1 default 1; limit >=1 default 20 without max.
- Sale nested `SaleLineDto`: productId string, quantity integer >=1, optional pricingOption NORMAL/PARTY. `CreateSaleDto`: optional customerId, guestName max 200; PaymentMethod and SalePaymentStatus enums; optional amountPaid decimal string; items array min 1, nested validation. `ListSalesDto`: optional from/to/customerId/paymentMethod/status/paymentStatus/recordedById strings; q max 200; page >=1 default 1; pageSize 1–100 default 25.
- `ExpenseDto`: categoryId string; amount decimal regex; optional description max 2000; expenseDate IsDateString (not strict). `CategoryDto`: name string 1–200.
- `RecordPaymentDto`: amount decimal regex with custom message “amount must be a positive decimal with at most two places” (regex permits zero); PaymentMethod enum; optional reference max 200.
- `CreateBookingDto`: roomId/customerId strings min 1; strict ISO date checkIn/checkOut; optional BookingSource enum. `ListBookingsDto`: optional strict from/to, BookingStatus enum, roomId/customerId strings; page >=1 default 1, pageSize 1–100 default 20. `UpdateBookingDto`: all optional; BookingStatus, roomId/customerId min 1, strict dates, BookingSource.
- `TenantRecordsController` accepts `Record<string,unknown>` without decorated DTO, so whitelist does not constrain it; service currently rejects generic modifications/deletions. Dashboard, availability, and expenses query fields bound individually also have no DTO validation.

## Global error format

All uncaught exceptions are returned as:

```json
{"statusCode":400,"message":"...or Nest response object...","path":"/requested/path?query=...","timestamp":"ISO-8601","requestId":"uuid-or-null"}
```

For `HttpException`, `message` is exactly `exception.getResponse()` (string/object; validation commonly an array). Unknown exceptions become 500 and `Internal server error`. `requestId` also appears in `X-Request-Id`. Preserve this shape rather than Express/Zod defaults. Test representative 400/401/403/404/409/422/429/500/503 responses. Booking conflicts use 409, out-of-service room 422, throttle 429, unavailable Redis throttling 503.

## Modules, providers, and dependency graph

| Module | Controller/provider(s) | Imports / relationships |
|---|---|---|
| AppModule | HealthController | global ConfigModule + PrismaModule; feature modules below |
| PrismaModule | global PrismaService | Prisma Client/PostgreSQL; lifecycle connect/disconnect |
| AuthModule | AuthController; AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, BusinessContextGuard, OriginGuard, ConfigService | PassportModule, JwtModule, ThrottlerModule; auth service uses Prisma/JWT/config/Argon2; strategy uses Prisma membership/user records |
| PropertiesModule | PropertiesController, PropertiesService | AuthModule |
| RoomsModule | RoomsController, RoomsService | AuthModule |
| CustomersModule | CustomersController, CustomersService | AuthModule |
| BusinessesModule | BusinessesController, BusinessesService | AuthModule |
| TenantRecordsModule | TenantRecordsController, TenantRecordsService | AuthModule |
| CatalogModule | CatalogController, CatalogService (exported) | global Prisma |
| InventoryModule | InventoryController, InventoryService | CatalogModule; auth guards referenced in route |
| SalesModule | SalesController, SalesService | global Prisma |
| ExpensesModule | ExpensesController, ExpensesService | global Prisma |
| DashboardModule | DashboardController, DashboardService | global Prisma |
| ReceiptsModule | ReceiptsController, ReceiptsService | AuthModule |
| BookingsModule | BookingsController, BookingsService | AuthModule |
| ActivityLogsModule | ActivityLogsController | global Prisma directly, no provider |
| PaymentsModule | PaymentsController, PaymentsService (exported) | AuthModule |

Runtime dependencies before migration: Prisma 6/PostgreSQL; Argon2 password and refresh-token hashes; Nest JWT + Passport JWT; optional Redis v4 custom throttler store; PDFKit receipts; Helmet; cookie-parser; Swagger/OpenAPI; shared money helpers; RxJS for interceptor. No mail, queue, or scheduler found. Preserve services, transaction boundaries, Prisma Decimal and calculations. Services have since been decoupled from Nest exception classes.

## Bootstrap, env, and test setup

`main.ts`: reflect-metadata; NestFactory; trust proxy; Helmet; cookie-parser; request ID; exact-origin credentialed CORS; global ValidationPipe/filter/interceptor; Swagger basic auth and UI; listen at `API_PORT ?? 3001`. `ConfigModule.forRoot` loads env file by default and validates required `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`; JWT secrets must differ.

Environment variables: required `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`; optional `API_PORT`, `API_ORIGIN`, `REDIS_URL`, `TRUST_PROXY`, `SWAGGER_USERNAME`, `SWAGGER_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `TENANT_TEST_DATABASE_URL`; `NODE_ENV` selects Secure cookie. `.env.example` documents these. Prisma reads DATABASE_URL; seed uses ADMIN_*.

Unit Jest config: rootDir `src`, `.*\.spec\.ts$`, ts-jest/Node; package script runs in-band; global statement coverage floor 19%, bookings 50%, payments 55%. Specs cover services, guards, controllers, middleware, filter, throttle storage, config, and schema tenant coverage. E2E config rootDir `test`, `.*\.e2e-spec\.ts$`, 30s timeout. Health e2e builds a small testing module with mocked Prisma and request ID middleware. Bookings/auth/lockout/tenant isolation use full AppModule and real dedicated Postgres where needed; some manually apply ValidationPipe, and tests do not uniformly invoke production `main.ts` middleware/filter/swagger setup. Tenant test requires migrated `TENANT_TEST_DATABASE_URL`. Replacement should use one `createApp()` shared by production and tests, with injected dependencies/mocks and a real-Postgres isolation suite.

## Nest-to-Express map and target architecture

The implementation uses **Express 4.21.2 + `asyncHandler`**. This retains the existing Express major version and avoids a dependency upgrade; the wrapper forwards rejected async handler promises to error middleware. The data layer, JWT signing/verification implementation, Argon2 and business services remain in use.

| Nest concept | Express replacement |
|---|---|
| Modules/providers/DI | feature routers + explicit composition root/container; constructor-inject existing services |
| Controllers/decorators | Router registrations calling thin controller functions |
| Guards/CanActivate | ordered async middleware: authenticate, requireBusiness, requireRole, requireOrigin, rateLimit |
| Passport JWT | direct verification through the existing `jsonwebtoken` library; retain bearer extraction, tokenVersion, active-user and membership checks |
| `@Roles` metadata | explicit route policy (`requireRole('OWNER')`); compatibility map ADMIN→OWNER membership |
| ValidationPipe/class-validator | Zod schemas + body/query middleware, `.strict()`, mapped compatibility validation errors, explicit preprocess/defaults |
| Exception filter | terminal error middleware; normalize Nest HttpException while services still throw them |
| Interceptor | request completion logger using `finish`/`close`, request ID and route template; no body wrapping |
| Middleware | Express Helmet, cookie parser, CORS, IDs, trust proxy, JSON parser |
| Throttler module/guard | rate-limit middleware + current Redis storage semantics, limits, fail-closed behavior and response headers |
| Parameter decorators | `req.params`, validated `req.body/query`, augmented typed request; `res` for cookies/PDF only |
| `@HttpCode` | explicit status constants; preserve Nest defaults (including POST 201 on logout) |
| SwaggerModule | removed for this migration; `/api/docs` and generated OpenAPI URLs are currently unavailable |
| Nest lifecycle hooks | explicit startup/shutdown: Prisma connect/disconnect, Redis quit, graceful HTTP close |
| Nest testing module | plain dependency injection through app factory and Supertest |

Implemented `apps/api/src` layout. Feature controllers/services stay in `src/<feature>` to preserve domain boundaries and existing service/test paths; the composition layer uses the shared folders below:

```text
app.ts                    # createApp: middleware, routers, error handler
server.ts                 # validated config, lifecycle, listen/shutdown
config/                   # env validation, trust proxy, typed config
container.ts              # Prisma, JWT, auth, services, adapters
routes/                   # feature routers and policy wiring
controllers/              # thin HTTP handlers
services/                 # existing business services retained initially
middleware/               # auth, tenant, roles, origin, ids, errors, logs, throttle
validation/               # Zod schemas and validation middleware
prisma/                   # existing service/schema/migrations
common/                   # errors, cookies, PDF/HTTP helpers
```

## Incremental migration order

1. Freeze route/OpenAPI and representative response, status, guard, error, cookie, header, validation, and throttle baseline.
2. Add Express factory alongside Nest; begin with health/live and test-only entry, leaving production on Nest.
3. Port health/readiness and establish shared testable app factory with mocked Prisma.
4. Port global middleware, error normalization, logging, CORS, proxy, cookies, IDs.
5. Port auth/business context/business creation; retain Passport, JWT, Argon2, Redis adapter.
6. Port read-focused property/customer/catalog/dashboard/activity routes and compare outputs.
7. Port writes for properties/rooms/customers/business modules/staff with strict schemas.
8. Port bookings and invoices/payments together; preserve transaction/locking/idempotency behavior and 201/409/422 statuses.
9. Port catalog/inventory/sales/receipts/expenses; preserve stock/sale invariants, receipt tokens, PDF headers, money serialization.
10. Run parity against fixtures and frontend; switch entrypoint only after route checklist passes, retaining a rollback path for one deployment window.
11. Remove Nest dependencies/decorators/reflect-metadata/RxJS and Nest test setup after runtime imports are gone.

## Risks and assumptions

- Inline `{isActive:boolean}` currently bypasses validator metadata; strict validation changes behavior, so capture and preserve or explicitly approve the correction.
- `@Type(() => Boolean)` makes string `"false"` true. Preserve this quirk for strict parity or separately approve correction.
- POST defaults to 201 even for archive and transition actions; Express defaults to 200 unless set explicitly.
- Services import/throw Nest exception types; keep Nest common during staged migration or normalize before removing it.
- `@Roles('ADMIN')` means business OWNER; conflating account and membership roles risks tenant privilege escalation.
- Redis throttling is distributed and fail-closed; memory-only limiting changes multi-instance and outage behavior.
- `req.ip` affects login lockout and throttle keys; trust proxy settings and middleware order must match.
- Characterize absent/disallowed Origin CORS behavior separately from OriginGuard enforcement.
- Swagger schemas may be incomplete where DTOs lack ApiProperty metadata; preserve secured docs paths and operational availability.
- Real Postgres e2e tests require a dedicated migrated `TENANT_TEST_DATABASE_URL`.
- Assumption: contract includes error envelope, status codes, cookie flags/path, CORS exposed header, docs URLs, PDF content disposition, and throttle semantics.

## Route-parity checklist

Mark each only after comparing method/path, policy, input validation, response fields, status, headers/cookies, and error envelope against Nest.

### Express migration verification (2026-10-21)

- Route registry parity test covers all 83 documented method/path pairs and confirms 401 for each JWT-protected route without a bearer token. Controller policy and tenant isolation are also exercised by unit/e2e tests; manually compare representative response fields and validation/error bodies before treating every checklist item as fully characterized.
- API checks passed: `corepack pnpm --filter api lint`, `corepack pnpm --filter api build`, and `corepack pnpm --filter api test` (33 suites, 138 tests).
- API e2e passed with the migrated dedicated test database: `corepack pnpm --filter api exec jest --config ./test/jest-e2e.config.json --runInBand --silent` (5 suites, 46 tests).
- Web checks passed: `corepack pnpm --filter web exec tsc --noEmit`, `corepack pnpm --filter web lint`, and `corepack pnpm --filter web build`. Web lint/build report a pre-existing exhaustive-deps warning in `apps/web/src/app/(dashboard)/sales/page.tsx` for `priceFor`.
- Live curl flow passed before the historical logout status correction: registration 201, login 201, authenticated `/auth/me` 200, refresh 201, logout 204. Re-run logout smoke after parity correction; temporary test accounts were removed.
- Known deviation: Swagger UI/OpenAPI endpoints were removed and are not route-parity checked.
- Contract review note: the Express auth design intentionally places refresh tokens only in an HttpOnly cookie and returns only `{accessToken}`; historical Nest register/login/refresh returned `{accessToken,refreshToken,user}` in JSON. Express refresh also reads the cookie and refresh/logout require an exact Origin, while historical refresh used `RefreshDto` and logout required JWT only. These are security improvements requested for the Express target, but they are externally observable contract changes and require an explicit migration decision before deployment.

- [ ] GET /health — HealthController.check
- [ ] GET /health/live — HealthController.live
- [ ] GET /health/ready — HealthController.ready
- [ ] POST /auth/register — AuthController.register
- [ ] POST /auth/login — AuthController.login
- [ ] POST /auth/refresh — AuthController.refresh
- [ ] GET /auth/me — AuthController.me
- [ ] POST /auth/logout — AuthController.logout
- [ ] POST /businesses — BusinessesController.create
- [ ] GET /businesses/profile — BusinessesController.profile
- [ ] GET /businesses/modules — BusinessesController.modules
- [ ] PATCH /businesses/modules — BusinessesController.setModule
- [ ] GET /businesses/staff — BusinessesController.staff
- [ ] POST /businesses/staff — BusinessesController.createStaff
- [ ] PATCH /businesses/staff/:userId — BusinessesController.setStaffActive
- [ ] GET /properties — PropertiesController.list
- [ ] GET /properties/:id — PropertiesController.get
- [ ] POST /properties — PropertiesController.create
- [ ] PATCH /properties/:id — PropertiesController.update
- [ ] DELETE /properties/:id — PropertiesController.remove
- [ ] GET /properties/:propertyId/rooms — RoomsController.list
- [ ] GET /properties/:propertyId/rooms/:roomId — RoomsController.get
- [ ] POST /properties/:propertyId/rooms — RoomsController.create
- [ ] PATCH /properties/:propertyId/rooms/:roomId — RoomsController.update
- [ ] DELETE /properties/:propertyId/rooms/:roomId — RoomsController.remove
- [ ] GET /customers — CustomersController.list
- [ ] GET /customers/:id — CustomersController.get
- [ ] POST /customers — CustomersController.create
- [ ] PATCH /customers/:id — CustomersController.update
- [ ] DELETE /customers/:id — CustomersController.remove
- [ ] GET /catalog — CatalogController.list
- [ ] GET /catalog/categories — CatalogController.categories
- [ ] GET /catalog/:id — CatalogController.get
- [ ] POST /catalog — CatalogController.create
- [ ] PATCH /catalog/:id — CatalogController.update
- [ ] POST /catalog/:id/archive — CatalogController.archive
- [ ] GET /inventory/products — InventoryController.products
- [ ] GET /inventory/summary — InventoryController.summary
- [ ] GET /inventory/low-stock — InventoryController.low
- [ ] GET /inventory/:productId/current — InventoryController.current
- [ ] GET /inventory/:productId/movements — InventoryController.history
- [ ] POST /inventory/stock-in — InventoryController.stockIn
- [ ] POST /inventory/stock-out — InventoryController.stockOut
- [ ] POST /inventory/adjustments — InventoryController.adjust
- [ ] GET /sales — SalesController.list
- [ ] GET /sales/:id — SalesController.get
- [ ] POST /sales — SalesController.create
- [ ] GET /expenses/categories — ExpensesController.categories
- [ ] POST /expenses/categories — ExpensesController.createCat
- [ ] PATCH /expenses/categories/:id — ExpensesController.updateCat
- [ ] DELETE /expenses/categories/:id — ExpensesController.archiveCat
- [ ] GET /expenses/summary — ExpensesController.summary
- [ ] GET /expenses — ExpensesController.list
- [ ] POST /expenses — ExpensesController.create
- [ ] PATCH /expenses/:id — ExpensesController.update
- [ ] DELETE /expenses/:id — ExpensesController.archive
- [ ] GET /dashboard/summary — DashboardController.summary
- [ ] GET /receipts/public/:token/pdf — ReceiptsController.publicPdf
- [ ] GET /receipts/public/:token — ReceiptsController.publicGet
- [ ] GET /receipts/:saleId — ReceiptsController.get
- [ ] GET /bookings — BookingsController.list
- [ ] GET /bookings/availability — BookingsController.availability
- [ ] POST /bookings — BookingsController.create
- [ ] GET /bookings/:id — BookingsController.get
- [ ] PATCH /bookings/:id — BookingsController.update
- [ ] DELETE /bookings/:id — BookingsController.remove
- [ ] POST /bookings/:id/check-in — BookingsController.checkIn
- [ ] POST /bookings/:id/confirm — BookingsController.confirm
- [ ] POST /bookings/:id/check-out — BookingsController.checkOut
- [ ] POST /bookings/:id/cancel — BookingsController.cancel
- [ ] POST /bookings/:id/no-show — BookingsController.noShow
- [ ] POST /bookings/:bookingId/invoice — PaymentsController.createInvoice
- [ ] POST /bookings/:bookingId/payments — PaymentsController.recordForBooking
- [ ] GET /invoices/:id — PaymentsController.invoice
- [ ] GET /invoices/:id/payments — PaymentsController.list
- [ ] POST /invoices/:id/void — PaymentsController.void
- [ ] POST /invoices/:id/payments — PaymentsController.record
- [ ] GET /payments/:id — TenantRecordsController.getPayment
- [ ] PATCH /payments/:id — TenantRecordsController.updatePayment
- [ ] DELETE /payments/:id — TenantRecordsController.removePayment
- [ ] PATCH /invoices/:id — TenantRecordsController.updateInvoice
- [ ] DELETE /invoices/:id — TenantRecordsController.removeInvoice
- [ ] GET /activity — ActivityLogsController.list
