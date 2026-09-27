# API

NestJS API workspace with Prisma/PostgreSQL. Copy `apps/api/.env.example` to `apps/api/.env`, apply migrations with `corepack pnpm --filter api exec prisma migrate deploy`, and seed the initial administrator with `corepack pnpm --filter api prisma:seed`. New accounts can create a business at `POST /businesses`; business owners are scoped to that tenant by membership resolved during JWT authentication.

Use a dedicated Postgres database for tenant isolation verification. Set `TENANT_TEST_DATABASE_URL` in `.env` and run `corepack pnpm --filter api test:e2e:tenant`; export the URL as `DATABASE_URL` and run `corepack pnpm --filter api exec prisma migrate deploy` before the test. The test deliberately fails when the database URL is absent and uses a real Prisma client rather than a mock.
