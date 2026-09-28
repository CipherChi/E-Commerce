# API

NestJS API workspace with Prisma/PostgreSQL. Copy `apps/api/.env.example` to `apps/api/.env`, apply migrations with `corepack pnpm --filter api exec prisma migrate deploy`, and seed the initial administrator with `corepack pnpm --filter api prisma:seed`. New accounts can create a business at `POST /businesses`; business owners are scoped to that tenant by membership resolved during JWT authentication.

Use a dedicated Postgres database for tenant isolation verification. Set `TENANT_TEST_DATABASE_URL` in `.env` and run `corepack pnpm --filter api test:e2e:tenant`; export the URL as `DATABASE_URL` and run `corepack pnpm --filter api exec prisma migrate deploy` before the test. The test deliberately fails when the database URL is absent and uses a real Prisma client rather than a mock.

## Catalog, inventory, and sales

Catalog items are business-scoped and assigned to an enabled service module (`LODGING`, `FOOD_BEVERAGE`, `GYM`, or `RETAIL`) with a free-text category. Only `isStockable` items enter inventory; lodging items are always non-stockable. Business owners can enable or disable modules in Settings; disabling hides those items from catalog and sales selection without deleting history. Catalog endpoints are under `/catalog` (including `/catalog/categories`), inventory endpoints under `/inventory`, and completed sales under `/sales`. Sale lines snapshot the current selling price. Completing a sale and its stock deductions happens in one serializable database transaction.

`StockMovement.quantity` is a signed delta: `STOCK_IN` uses a positive integer, `STOCK_OUT` uses a negative integer, and `ADJUSTMENT` uses a positive or negative correction with a required reason. Current stock is the sum of these movements; it is not stored on the catalog item. Stock-outs that would take the balance below zero fail.

The seed creates sample catalog items for the default business across Lodging and Food & Beverage modules. Drinks and Water are stockable and have low-stock thresholds.
