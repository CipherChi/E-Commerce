# Architecture Decision: Modular Monolith

**Status:** Accepted
**Date:** 2026-10-20

## Decision

Keep the API as a NestJS modular monolith. Do not split the current domains into
independently deployed microservices, add an API gateway, or add a message
broker. Ratings, reviews, and search will be implemented as NestJS modules in
`apps/api` and will use the existing PostgreSQL database and Prisma schema.

## Current shape

The pnpm workspace contains the Next.js frontend (`apps/web`), NestJS API
(`apps/api`), and shared contracts/types (`packages/shared-types`). The API
modules are registered in `apps/api/src/app.module.ts`. Domains currently
include auth, businesses, bookings, properties, rooms, customers, catalog,
inventory, sales, expenses, dashboard, receipts, activity logs, and payments.
Prisma/PostgreSQL is the API's shared persistence layer. `infra/docker-compose.yml`
is for local PostgreSQL and Adminer; it is not a service deployment topology.

## Module ownership and dependencies

Each domain module owns the business rules and writes for its domain tables.
Other modules must use the owning module's exported application service rather
than directly querying or mutating another module's Prisma models. Shared
cross-domain read models should be exposed through an explicit application
service. New modules must export only the services and DTOs needed by consumers.

This is a target boundary for new work, not a claim that all current code
already follows it. Existing cross-domain Prisma access should be treated as
technical debt and changed only when touched by scoped work. In particular,
payments and reporting/customer views currently read related booking, invoice,
and payment records directly.

## Adding domain modules

Search, ratings, and reviews will each have a NestJS module, controller,
service, DTOs, and tests under `apps/api/src/<domain>/`. Their data models and
migrations remain in the shared Prisma schema. Every tenant-owned operation
must scope access by `businessId`, and authorization remains enforced by API
guards/services. Cross-domain workflows call exported services in-process;
they do not introduce a broker or direct module-to-module database access.

## Future extraction path

If operational or scaling needs later justify extracting a domain, first make
its data ownership and service boundary explicit, then define a versioned API
or event contract, service authentication, retries/timeouts, and an ownership-
preserving data migration. Extraction requires a separate architecture
decision; this document does not authorize a gateway, broker, or service split.
