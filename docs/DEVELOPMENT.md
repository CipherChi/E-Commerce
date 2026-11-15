# Development guide

## Prerequisites

- Node.js 20 or newer
- pnpm 9.15.0 (pinned in `package.json`)
- Docker Desktop with the Linux container engine running

## First run

From the repository root:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker-compose.yml up -d postgres
pnpm --filter api exec prisma migrate deploy
pnpm --filter api prisma:seed
pnpm dev:api
pnpm dev:web
```

Open <http://localhost:3000>. Set `ADMIN_EMAIL`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 12 characters in `apps/api/.env` before seeding. Keep this account password private.

## Useful commands

```sh
pnpm dev:web
pnpm dev:api
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api exec prisma migrate status
pnpm build:web
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml logs -f postgres
docker compose -f infra/docker-compose.yml down
```

To stop PostgreSQL and remove the local database volume, use `docker compose -f infra/docker-compose.yml down -v`. This permanently removes the local development database contents.

## Environment

Copy `.env.example` to `.env` for local values. Keep `.env` out of Git and replace the sample secrets before any shared or production deployment.

## Troubleshooting

- If Docker commands cannot reach the engine, start Docker Desktop and select Linux containers.
- If port 5432 is occupied, stop the other local PostgreSQL service before starting the Compose database.
- If a workspace package cannot be resolved after checkout, rerun `pnpm install` from the repository root.

## Manual QA checklist

Use a disposable development tenant with test data. Confirm registration and sign-in; create a business and confirm a second tenant cannot read its records; add a property, room, customer, product, and opening stock; create, confirm, check in, and check out a booking; record a partial payment and verify the invoice balance; record a sale and verify stock movement and receipt output; then review dashboard totals, expenses, sign-out, and the public receipt link. Record the date, browser, account type, and any failures before release. Do not use production data for this checklist.
