# Express API

The API is an Express 4 application written in TypeScript, with Zod request validation and Prisma/PostgreSQL persistence. The maintained route and guard contract is [documented here](../../docs/api-routes.md). An interactive API documentation endpoint is not included.

## Install and configure

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
```

Copy `apps/api/.env.example` to `apps/api/.env`, set distinct random JWT secrets of at least 32 characters and a PostgreSQL `DATABASE_URL`, and set `WEB_ORIGIN` to the web app's origin. For a local database, start PostgreSQL with `docker compose -f infra/docker-compose.yml up -d postgres`. Apply the checked-in migrations and optionally seed an initial owner:

```sh
corepack pnpm --filter api exec prisma migrate deploy
corepack pnpm --filter api prisma:seed
```

## Run, build, lint, and test

```sh
corepack pnpm dev:api
corepack pnpm --filter api build
corepack pnpm --filter api lint
corepack pnpm --filter api test
corepack pnpm --filter api test:e2e
```

The development command reads `apps/api/.env`. The compiled server reads process environment variables in production; container/deployment examples set those directly.

The e2e suite uses a dedicated, migrated test database and must not use development or production data. Configure both `TENANT_TEST_DATABASE_URL` and `DATABASE_URL` to a disposable PostgreSQL database named `hotel_manager_test`, then migrate and run:

```powershell
$env:TENANT_TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/hotel_manager_test?schema=public"
$env:DATABASE_URL = $env:TENANT_TEST_DATABASE_URL
corepack pnpm --filter api exec prisma migrate deploy
corepack pnpm --filter api test:e2e
```

The tenant suite refuses to run when `TENANT_TEST_DATABASE_URL` is missing. CI creates an ephemeral PostgreSQL database for these tests.

## Operational behavior

- `/health/live` checks that the process responds. `/health/ready` and `/health` also probe PostgreSQL.
- Set `REDIS_URL` for shared rate limits across multiple API replicas; without it, storage is process-local.
- `TRUST_PROXY` accepts `false` or a positive trusted hop count. Do not trust arbitrary forwarded headers.
- `SENTRY_DSN` is optional. When set, only a sanitized generic server error event and request ID are sent; request URL, headers, cookies, and body are not included.
- Database backups and deployment environment requirements are described in [deployment](../../docs/deployment.md) and [backup/restore](../../docs/backup-restore.md).

