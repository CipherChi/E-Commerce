# E Commerce Site

![E Commerce Site cover](docs/assets/cover.svg)

**E Commerce Site – multi-tenant retail platform.** The current app combines hospitality operations with customer records, catalog, inventory, sales, receipts, expenses, and reporting. It does not provide a public shopper cart or online checkout. See [Project Overview](docs/PROJECT_OVERVIEW.md) for the verified feature list and architecture.

## What is implemented

- Business registration, sign-in, refresh-token sessions, account lockout, tenant membership, roles, and business module settings.
- Property and room management, customer records, bookings, booking status transitions, invoices, and staff-recorded payments.
- Product catalog, stock movements, sales, idempotent sale creation, and digital/PDF receipts.
- Expense tracking, tenant-scoped dashboard reporting, and PWA shell assets.
- PostgreSQL persistence with Prisma migrations, API health endpoints, tenant-isolation checks, and a Playwright retail sales/receipt flow.

The current app has no public shopper accounts, cross-merchant storefront, cart, online payment gateway, or platform-wide super-admin UI. Payment records are entered by tenant staff.

## Requirements

- Node.js 20 or newer
- pnpm 9.15.0 (pinned by the workspace)
- Docker with Compose and PostgreSQL 16, or a PostgreSQL 16 database you manage

## Local setup

Run from the repository root:

1. Install dependencies: `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env` and `apps/api/.env.example` to `apps/api/.env`. Use distinct random JWT secrets and set local database and seed administrator values in `apps/api/.env`.
3. Start PostgreSQL: `docker compose -f infra/docker-compose.yml up -d postgres`.
4. Apply migrations and seed the administrator:

   ```sh
   pnpm --filter api exec prisma migrate deploy
   pnpm --filter api prisma:seed
   ```

5. Start the API and web app in separate terminals:

   ```sh
   pnpm dev:api
   pnpm dev:web
   ```

6. Open <http://localhost:3000>. Sign in with the seeded administrator or register an account and create a business.

The local database is named `hotel_manager`. Environment variable keys, database names, and package scopes remain the existing project identifiers. The `.env.example` files contain placeholders only; never use them in a deployed environment.

## Checks

```sh
pnpm lint
pnpm --filter api lint
pnpm --filter api exec prisma generate --schema prisma/schema.prisma
pnpm build
pnpm --filter api exec jest --coverage --ci --runInBand
pnpm audit --prod --audit-level high
```

Database tests require a dedicated disposable database. The API e2e suite uses `TENANT_TEST_DATABASE_URL`; set `DATABASE_URL` to the same test URL and apply migrations before running `pnpm --filter api test:e2e`. Never point e2e commands at a development, staging, or production database.

The Playwright script accepts only a database named `hotel_manager_test` and resets it before running. Set `TENANT_TEST_DATABASE_URL` to that dedicated database, install Chromium with `pnpm --filter web exec playwright install chromium`, then run:

```sh
pnpm --filter web test:e2e
```

CI also migrates a clean PostgreSQL database and checks schema drift. See [Project Overview](docs/PROJECT_OVERVIEW.md) for the full verification commands and limits.

## Operations and API notes

- The interactive Swagger endpoint is not shipped. Current route/runtime notes are in [the Express migration plan](docs/express-migration-plan.md).
- `REDIS_URL` enables shared API throttling across instances; without Redis, the API uses in-memory throttling suited to a single process.
- `TRUST_PROXY` defaults to `false`. Set it to the trusted proxy hop count when deployed behind a known proxy.
- See [Development](docs/DEVELOPMENT.md), [Deployment](docs/deployment.md), [Backup and restore](docs/backup-restore.md), [Tenant isolation](docs/TENANT-ISOLATION.md), and [Branching](docs/BRANCHING.md).
