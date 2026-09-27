# Development guide

## Prerequisites

- Node.js 20 or newer
- Corepack (`corepack enable`); the repository pins pnpm 9.15.0 in `package.json`
- Docker Desktop with the Linux container engine running

## First run

From the repository root:

```sh
corepack pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose -f infra/docker-compose.yml up -d postgres
corepack pnpm --filter api exec prisma migrate deploy
corepack pnpm --filter api prisma:seed
corepack pnpm dev:api
corepack pnpm dev:web
```

Open <http://localhost:3000>. Set `ADMIN_EMAIL`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 12 characters in `apps/api/.env` before seeding. Keep this account password private.

## Useful commands

```sh
corepack pnpm dev:web
corepack pnpm dev:api
corepack pnpm --filter api test
corepack pnpm --filter api test:e2e
corepack pnpm --filter api exec prisma migrate status
corepack pnpm build:web
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
- If a workspace package cannot be resolved after checkout, rerun `corepack pnpm install` from the repository root.
