# Hotel / Short-let Business Manager

Phase 1 monorepo for reservation-to-cash operations. The intended stack is NestJS, Prisma, PostgreSQL, and Next.js. Manual payments only; no Paystack, Termii, WhatsApp, or offline sync implementation.

## Setup

1. Install Node 20+ and pnpm.
2. `docker compose -f infra/docker-compose.yml up -d`
3. Copy `.env.example` to `.env` and run `pnpm install`.
4. Run `pnpm --filter api prisma:migrate` and `pnpm --filter api prisma:seed`.
5. Start the API and web app with `pnpm --filter api start:dev` and `pnpm --filter web dev`.

See each app README for details. Do not use demo credentials in production.
