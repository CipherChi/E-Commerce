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
docker compose -f infra/docker-compose.yml up -d postgres
corepack pnpm dev:web
```

Open <http://localhost:3000>. The initial web shell runs independently of the API. API bootstrap, authentication, and Prisma migrations are delivered in milestone M1; do not start M1 work until the M0 checks in the GitHub project pass.

## Useful commands

```sh
corepack pnpm dev:web
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
