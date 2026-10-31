# Architecture Decision: Express API Monolith

**Status:** Accepted  
**Date:** 2026-10-20

## Decision

Keep the API as a modular Express monolith. Do not split the current domains
into independently deployed services, add an API gateway, or add a message
broker. New domains use the existing PostgreSQL database and Prisma schema.

## Current shape

The pnpm workspace contains the Next.js frontend (`apps/web`), Express API
(`apps/api`), and shared contracts/types (`packages/shared-types`). The API
starts from `src/server.ts` and builds an application through the `createApp`
factory in `src/app.ts`. The factory configures security, CORS, JSON parsing,
cookies, request IDs, logging, routes, and error handling without binding a
port, so production and tests share the same setup.

Route registration lives in `src/routes/`. Route handlers call domain
controllers and services under `src/<domain>/`; Prisma/PostgreSQL is the
shared persistence layer. Middleware under `src/middleware/` handles auth,
authorization, rate limiting, request logging, not-found responses, and
errors. Zod schemas under `src/validation/` validate API bodies and queries,
including the auth schemas and route validation registry. The API uses
`infra/docker-compose.yml` for local PostgreSQL and Adminer; it is not a
service deployment topology.

## Domain ownership

Each domain owns its business rules and writes for its tables. Other domains
should use the owning domain's service rather than directly querying or
mutating another domain's Prisma models. Shared cross-domain read models should
be exposed through an explicit service. Existing cross-domain Prisma access is
technical debt and should be changed when touched by scoped work.

## Adding domains

Add a domain's routes, controller/service, validation schemas, and tests under
`apps/api/src/<domain>/`. Keep data models and migrations in the shared Prisma
schema. Every tenant-owned operation must scope access by `businessId`, and
authorization remains enforced by middleware and services. Cross-domain
workflows call services in-process.

## Future extraction path

If operational or scaling needs later justify extracting a domain, first make
its data ownership and service boundary explicit, then define a versioned API
or event contract, service authentication, retries/timeouts, and an ownership-
preserving data migration. Extraction requires a separate architecture
decision; this document does not authorize a gateway, broker, or service split.

## Migration record

The API previously used NestJS modules and Swagger/OpenAPI documentation. The
Express migration removed that runtime and documentation endpoint. Historical
details are recorded in [`docs/express-migration-plan.md`](express-migration-plan.md).
