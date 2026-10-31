# API route inventory

This file is the maintained method/path/access-policy contract used by `apps/api/src/routes/route-parity.spec.ts`. POST routes use HTTP 201 by default; GET, PATCH, and DELETE routes use HTTP 200 unless a route documents otherwise. `OWNER` is the business membership role corresponding to the legacy `ADMIN` policy name.

| Method | Path | Access policy |
|---|---|---|
| GET | /health | — |
| GET | /health/live | — |
| GET | /health/ready | — |
| POST | /auth/register | Throttler (5/min) |
| POST | /auth/login | Throttler (5/min) |
| POST | /auth/refresh | Throttler (5/min) |
| GET | /auth/me | JWT |
| POST | /auth/logout | JWT |
| POST | /businesses | JWT |
| GET | /businesses/profile | JWT, BC |
| GET | /businesses/modules | JWT, BC |
| PATCH | /businesses/modules | JWT, BC, R(ADMIN) |
| GET | /businesses/staff | JWT, BC, R(ADMIN) |
| POST | /businesses/staff | JWT, BC, R(ADMIN) |
| PATCH | /businesses/staff/:userId | JWT, BC, R(ADMIN) |
| GET | /properties | JWT, BC |
| GET | /properties/:id | JWT, BC |
| POST | /properties | JWT, BC, R(ADMIN) |
| PATCH | /properties/:id | JWT, BC, R(ADMIN) |
| DELETE | /properties/:id | JWT, BC, R(ADMIN) |
| GET | /properties/:propertyId/rooms | JWT, BC, RolesGuard (no metadata, allows) |
| GET | /properties/:propertyId/rooms/:roomId | JWT, BC, RolesGuard (no metadata, allows) |
| POST | /properties/:propertyId/rooms | JWT, BC, RolesGuard + R(ADMIN) |
| PATCH | /properties/:propertyId/rooms/:roomId | JWT, BC, RolesGuard + R(ADMIN) |
| DELETE | /properties/:propertyId/rooms/:roomId | JWT, BC, RolesGuard + R(ADMIN) |
| GET | /customers | JWT, BC |
| GET | /customers/:id | JWT, BC |
| POST | /customers | JWT, BC |
| PATCH | /customers/:id | JWT, BC, R(ADMIN) |
| DELETE | /customers/:id | JWT, BC, R(ADMIN) |
| GET | /catalog | JWT, BC |
| GET | /catalog/categories | JWT, BC |
| GET | /catalog/:id | JWT, BC |
| POST | /catalog | JWT, BC, R(ADMIN) |
| PATCH | /catalog/:id | JWT, BC, R(ADMIN) |
| POST | /catalog/:id/archive | JWT, BC, R(ADMIN) |
| GET | /inventory/products | JWT, BC, R(ADMIN) controller-wide |
| GET | /inventory/summary | JWT, BC, R(ADMIN) controller-wide |
| GET | /inventory/low-stock | JWT, BC, R(ADMIN) controller-wide |
| GET | /inventory/:productId/current | JWT, BC, R(ADMIN) controller-wide |
| GET | /inventory/:productId/movements | JWT, BC, R(ADMIN) controller-wide |
| POST | /inventory/stock-in | JWT, BC, R(ADMIN) controller + method |
| POST | /inventory/stock-out | JWT, BC, R(ADMIN) controller + method |
| POST | /inventory/adjustments | JWT, BC, R(ADMIN) controller + method |
| GET | /sales | JWT, BC |
| GET | /sales/:id | JWT, BC |
| POST | /sales | JWT, BC |
| GET | /expenses/categories | JWT, BC, R(ADMIN) controller-wide |
| POST | /expenses/categories | JWT, BC, R(ADMIN) |
| PATCH | /expenses/categories/:id | JWT, BC, R(ADMIN) |
| DELETE | /expenses/categories/:id | JWT, BC, R(ADMIN) |
| GET | /expenses/summary | JWT, BC, R(ADMIN) |
| GET | /expenses | JWT, BC, R(ADMIN) |
| POST | /expenses | JWT, BC, R(ADMIN) |
| PATCH | /expenses/:id | JWT, BC, R(ADMIN) |
| DELETE | /expenses/:id | JWT, BC, R(ADMIN) |
| GET | /dashboard/summary | JWT, BC |
| GET | /receipts/public/:token/pdf | Throttler (20/min) |
| GET | /receipts/public/:token | Throttler (20/min) |
| GET | /receipts/:saleId | JWT, BC |
| GET | /bookings | JWT, BC |
| GET | /bookings/availability | JWT, BC |
| POST | /bookings | JWT, BC |
| GET | /bookings/:id | JWT, BC |
| PATCH | /bookings/:id | JWT, BC, R(ADMIN) |
| DELETE | /bookings/:id | JWT, BC, R(ADMIN) |
| POST | /bookings/:id/check-in | JWT, BC, R(ADMIN) |
| POST | /bookings/:id/confirm | JWT, BC, R(ADMIN) |
| POST | /bookings/:id/check-out | JWT, BC, R(ADMIN) |
| POST | /bookings/:id/cancel | JWT, BC, R(ADMIN) |
| POST | /bookings/:id/no-show | JWT, BC, R(ADMIN) |
| POST | /bookings/:bookingId/invoice | JWT, BC, R(ADMIN) |
| POST | /bookings/:bookingId/payments | JWT, BC, R(ADMIN) |
| GET | /invoices/:id | JWT, BC, R(ADMIN) |
| GET | /invoices/:id/payments | JWT, BC, R(ADMIN) |
| POST | /invoices/:id/void | JWT, BC, R(ADMIN) |
| POST | /invoices/:id/payments | JWT, BC, R(ADMIN) |
| GET | /payments/:id | JWT, BC, R(ADMIN) |
| PATCH | /payments/:id | JWT, BC |
| DELETE | /payments/:id | JWT, BC |
| PATCH | /invoices/:id | JWT, BC |
| DELETE | /invoices/:id | JWT, BC |
| GET | /activity | JWT, BC |
