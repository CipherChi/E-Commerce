# Hotel / Short-let Business Manager

Phase 1 monorepo for reservation-to-cash operations, built with Next.js, NestJS, Prisma, and PostgreSQL. Payments are recorded manually. Paystack, Termii, WhatsApp, and offline sync remain out of scope until Phase 2.

## Requirements

- Node.js 20 or newer
- pnpm 9
- Docker Desktop with the Linux container engine running

## Local setup

1. Install the locked dependencies with `corepack pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env` and `apps/api/.env.example` to `apps/api/.env`; set distinct random JWT secrets and an administrator email, name, and password of at least 12 characters in the API environment.
3. Start PostgreSQL with `docker compose -f infra/docker-compose.yml up -d postgres`.
4. Apply migrations and create the administrator with `corepack pnpm --filter api exec prisma migrate deploy` and `corepack pnpm --filter api prisma:seed`.
5. Start the API and web app in separate terminals with `corepack pnpm dev:api` and `corepack pnpm dev:web`, then open <http://localhost:3000>.

Sign in with the seeded administrator account, or register an account and create a business. Business owners can add properties and rooms. Customers and all property records are scoped to the active business; use `/customers` to add, search, edit, and archive customer records.

Local development and tenant-isolation tests use separate databases on the same `infra` PostgreSQL server at `localhost:5432`: `hotel_manager` for the app and `hotel_manager_test` for tests. CI creates its own ephemeral `app_test` database; no extra local CI database container is needed.

The tenant-isolation end-to-end suite uses the real `hotel_manager_test` database. Set `TENANT_TEST_DATABASE_URL` to that database in PowerShell, then run:

```powershell
$env:TENANT_TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/hotel_manager_test?schema=public"
$env:DATABASE_URL = $env:TENANT_TEST_DATABASE_URL
corepack pnpm --filter api exec prisma migrate deploy
corepack pnpm --filter api test:e2e:tenant
```

The test makes two businesses and verifies GET, PATCH, and DELETE for customers, properties, rooms, bookings, payments, and invoices. It refuses to run without the dedicated database URL.

See [Development](docs/DEVELOPMENT.md) for setup and troubleshooting, and [Branching](docs/BRANCHING.md) for the Git workflow. Do not use the sample credentials in production.
