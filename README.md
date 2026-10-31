# Hotel / Short-let Business Manager

A pnpm monorepo for reservation-to-cash operations. It contains a Next.js App Router web app (`apps/web`), an Express 4 TypeScript API (`apps/api`), Prisma, and PostgreSQL. Payments are recorded manually; Paystack, Termii, WhatsApp, and offline sync are outside the current scope.

## Requirements

- Node.js 20 or newer
- Corepack and pnpm 9.15.0 (`corepack pnpm` uses the pinned package manager)
- Docker with Compose for local PostgreSQL, or a PostgreSQL 16 database you manage

## First-time setup

Run commands from the repository root.

1. Install dependencies: `corepack pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env` and `apps/api/.env.example` to `apps/api/.env`. Set distinct random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values of at least 32 characters, plus the API `DATABASE_URL`, `WEB_ORIGIN`, and seed administrator fields.
3. Start local PostgreSQL: `docker compose -f infra/docker-compose.yml up -d postgres`.
4. Apply database migrations and create the seed administrator:

   ```sh
   corepack pnpm --filter api exec prisma migrate deploy
   corepack pnpm --filter api prisma:seed
   ```

5. Start the API and web app in separate terminals:

   ```sh
   corepack pnpm dev:api
   corepack pnpm dev:web
   ```

6. Open <http://localhost:3000>. Sign in with the administrator configured in `apps/api/.env`, or register an account and create a business.

The default local database is `hotel_manager` at `localhost:5432`. The API loads `apps/api/.env`; Next loads the root `.env`. The checked-in examples contain placeholders only. Never use those values in a deployed environment.

## Common commands

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev:api
corepack pnpm dev:web
corepack pnpm --filter api build
corepack pnpm --filter web build
corepack pnpm --filter api lint
corepack pnpm --filter api test
corepack pnpm --filter api test:e2e
```

`test:e2e` includes suites that need a dedicated migrated PostgreSQL database. Configure a separate database named `hotel_manager_test` in `TENANT_TEST_DATABASE_URL` and point `DATABASE_URL` at that same test database before running migrations and tests. In PowerShell:

```powershell
$env:TENANT_TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/hotel_manager_test?schema=public"
$env:DATABASE_URL = $env:TENANT_TEST_DATABASE_URL
corepack pnpm --filter api exec prisma migrate deploy
corepack pnpm --filter api test:e2e
```

Do not point either variable at a development, staging, or production database. The e2e tests create and remove test records.

## API contract and runtime notes

The interactive API documentation endpoint is not shipped. The maintained method/path/guard inventory is in [API routes](docs/api-routes.md); the migration plan contains the response and validation contract detail. API health endpoints are `/health/live` and `/health/ready` (also `/health`).

Set `REDIS_URL` to share API throttling across instances. Without Redis, throttling uses in-memory storage, suitable only for a single local process. `TRUST_PROXY` defaults to `false`; set it to the number of trusted proxy hops when deployed behind a known proxy. Login uses a generic credential error and persisted progressive lockout.

See [Deployment](docs/deployment.md), [Backup and restore](docs/backup-restore.md), [Development](docs/DEVELOPMENT.md), and [Branching](docs/BRANCHING.md) for operations and contributor details.
