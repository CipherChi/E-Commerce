# API

The API is an Express 4 application written in TypeScript. Copy `apps/api/.env.example` to `apps/api/.env`, set the required database and JWT secrets, and apply migrations with `pnpm --filter api exec prisma migrate deploy`.

From the repository root:

- `pnpm --filter api start:dev` runs the API with reload.
- `pnpm --filter api build` compiles to `apps/api/dist`.
- `pnpm --filter api start` runs the compiled server.
- `pnpm --filter api lint` runs ESLint on API TypeScript sources.
- `pnpm --filter api test` runs unit tests.
- `pnpm --filter api test:e2e` runs e2e tests.

Tests that exercise tenant isolation use a dedicated Postgres database. Set `TENANT_TEST_DATABASE_URL` in `.env`, export that URL as `DATABASE_URL`, and run Prisma migrations against it before `pnpm --filter api test:e2e`.

The previous Nest Swagger UI at `/api/docs` is not currently served. Route and DTO contracts are documented in [`docs/express-migration-plan.md`](../../docs/express-migration-plan.md); that route inventory is also used by the route-parity test.

New accounts can create a business at `POST /businesses`. Catalog items are business-scoped and assigned to an enabled service module (`LODGING`, `FOOD`, `BEVERAGE`, or `GYM`) with a free-text category. Only `isStockable` items enter inventory; lodging items are always non-stockable. Business owners can enable or disable modules in Settings; disabling hides those items from catalog and sales selection without deleting history. Completed sale lines snapshot the selected type-specific price, and sale completion plus stock deductions happens in one serializable database transaction.
