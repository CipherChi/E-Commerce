# M0–M10 implementation status

This report reflects the work on `fix/batch-1-foundation` based on `release/m0-m10`. This is not a real-world-testing readiness claim. No PR or CI run has been created yet.

| Milestone | Status (Complete / Partial / Not started) | Evidence | Remaining gaps |
|---|---|---|---|
| M0 — setup and runtime | Partial | `README.md`, `docs/DEVELOPMENT.md`, `apps/api/src/app.module.ts`, `apps/api/src/health.controller.ts`; `pnpm build` passed | Frozen install is not demonstrated cleanly on this host; setup not literally replayed from a clean checkout; no health endpoint test |
| M1 — auth | Partial | `apps/api/src/auth/dto/register.dto.ts`; `apps/api/test/auth.e2e-spec.ts` (invalid/short password, expired access, logout/tokenVersion, revoked refresh); full auth e2e passed | No login rate limiting; no test directly asserting refresh hash storage; secrets validation is implemented but missing-secret cases are not tested |
| M2 — tenant safety | Partial | `apps/api/test/tenant-isolation.e2e-spec.ts`; real Postgres suite passed 7 tests; `TENANT_TEST_DATABASE_URL` required and used | No schema-coverage guard; ambient module tenant tests missing; BusinessModule/business isolation not included; no ActivityLog businessId or scoped queries |
| M3 — customers | Partial | `apps/api/src/customers/customers.service.ts`, existing unit spec | Outstanding balance derivation and real booking history not implemented; requested balance test missing |
| M4 — properties and rooms | Partial | `apps/api/src/properties/*`, `apps/api/src/rooms/*`; existing unit specs pass | No new list/create component or Playwright coverage in this batch |
| M5 — bookings | Partial | Prisma Booking model and generic tenant routes exist | Create/list, overlap constraint, state machine, check-in/out, booking UI and required concurrency tests are absent |
| M6 — payments/invoices | Partial | Prisma Payment/Invoice Decimal models and generic tenant routes exist | Central payment service, idempotency, derived balance/status and invoice UI/tests are absent |
| M7 — dashboard | Partial | `apps/api/src/dashboard/*` and dashboard page exist | Occupancy/arrivals/departures and collected-vs-outstanding calculations/tests are absent |
| M8 — end-to-end proof and hardening | Not started | None | No Playwright config or full-flow spec, retail service unit coverage, 60% coverage floor, or manual QA run |
| M9 — CI and repo controls | Partial | pre-existing `.github/workflows/ci.yml` defines the requested job categories; empty DB migrations and drift passed locally | CI not run on a PR; hooks/templates/owners missing; branch protection not configured; CI aggregate not verified green |
| M10 — provider/offline seams | Partial | `packages/shared-types` contains client interfaces | No injection contract tests, ADR, receipt-share decision doc, or code search evidence for no Paystack/Termii calls |

**Furthest milestone complete in sequence:** none. M0 is partial, so no later milestone can be called complete.

## Commands and results

- `pnpm install --frozen-lockfile` — failed under the global pnpm 11.19.0 with `ERR_PNPM_IGNORED_BUILDS`. `corepack pnpm --version` returned 9.15.0. A pinned `corepack pnpm install --frozen-lockfile` exited 0 after showing a node_modules replacement prompt, but a clean-checkout install was not demonstrated.
- `corepack pnpm build` — passed after the foundation edits; API and Next.js production build completed.
- `corepack pnpm lint` — passed; Next reported no ESLint warnings/errors.
- `corepack pnpm --filter api test -- --runInBand` — passed, 5 suites / 17 tests.
- `TENANT_TEST_DATABASE_URL=... corepack pnpm --filter api test:e2e:tenant` — passed, 1 suite / 7 tests against local Postgres 16. Migrations were deployed to `hotel_manager_test` first.
- `TENANT_TEST_DATABASE_URL=... corepack pnpm --filter api test:e2e` — passed, 2 suites / 11 tests against real Postgres plus mocked auth Prisma.
- Fresh database migration check: created throwaway `hotel_manager_empty_test`; deployed all 8 migrations; `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` reported `No difference detected.`
- Playwright — not run; no config/spec exists.
- Coverage — measured after the unit run: 9.16% statements (5 suites / 17 tests). The stale audit summary reported 9.25% before; the threshold remains 9% and the requested coverage ratchet was not implemented.

## Decisions

See [DECISIONS.md](DECISIONS.md). Password minimum is 12; monetary values remain Decimal; Prisma/SQL use camelCase `businessId`.

## Manual owner follow-ups

- Configure `main` protection to require PRs, one review, and `CI passed`; exact manual steps are in [REPO-SETTINGS.md](REPO-SETTINGS.md). `gh` is not installed, so no API attempt or PR CI run was possible.
- Complete remaining milestones and run the Playwright real-world flow before treating this system as ready for testing.

