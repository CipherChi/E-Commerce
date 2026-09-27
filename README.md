# Hotel / Short-let Business Manager

Phase 1 monorepo for reservation-to-cash operations, built with Next.js, NestJS, Prisma, and PostgreSQL. Payments are recorded manually. Paystack, Termii, WhatsApp, and offline sync remain out of scope until Phase 2.

## Requirements

- Node.js 20 or newer
- pnpm 9
- Docker Desktop with the Linux container engine running

## Local setup

1. Install dependencies with `corepack pnpm install`.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with `docker compose -f infra/docker-compose.yml up -d postgres`.
4. Start the web app with `corepack pnpm dev:web` and open <http://localhost:3000>.

The API and Prisma migration workflow are introduced in milestone M1. Until then, the web app runs independently while PostgreSQL is available for database setup work.

See [Development](docs/DEVELOPMENT.md) for setup and troubleshooting, and [Branching](docs/BRANCHING.md) for the Git workflow. Do not use the sample credentials in production.
