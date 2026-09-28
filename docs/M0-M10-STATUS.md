# M0–M10 implementation status

This report is for `fix/batch-1-foundation` at the latest local commits. The branch is pushed, but no pull request or hosted CI run exists yet. This is not a real-world-testing readiness claim.

| Milestone | Status (Complete / Partial / Not started) | Evidence | Remaining gaps |
|---|---|---|---|
| M0 — setup and runtime | Partial | Root `package.json` pins pnpm 9.15.0 and `pnpm.onlyBuiltDependencies`; fresh temporary clone install passed; env validator has tests; health controller unit and real-Postgres e2e pass | Full README setup not replayed end-to-end (seed/API/web startup); direct host `pnpm` is 11.19.0, so use Corepack to honor the pin |
| M1 — auth | Partial | `@nestjs/throttler` on register/login/refresh; `auth.e2e-spec.ts` proves repeated invalid login gets 429, expired access and logout revocation; `auth.service.spec.ts` proves refresh token stored hashed; env validation tests | In-memory throttler state is per API process; M1 remains sequence-incomplete while M0 is partial |
| M2 — tenant safety | Partial | Real Postgres `tenant-isolation.e2e-spec.ts` passes list/detail/mutation checks on every available tenant route, including retail, inventory, sales/receipts, expense summaries/categories, module settings, dashboard and activity; `tenant-schema-coverage.spec.ts` parses schema and requires every model with `businessId` in the explicit spec inventory; ActivityLog migration backfills single-membership history and activity list filters by authenticated `businessId` | `CatalogCategory`, `BusinessMember`, `SaleItem`, and stock movements have no standalone CRUD surface; existing APIs are tested at their parent/list routes and unsupported methods return 404. Multi-membership historical activity remains nullable because its action business cannot be inferred |
| M3 — customers | Partial | Existing customer service and unit tests | Derived outstanding balance and booking history remain missing |
| M4 — properties and rooms | Partial | Existing property/room services and unit tests | No new list/create browser-flow coverage in this batch |
| M5 — bookings | Partial | Existing schema and generic tenant-record endpoints | Booking engine, overlap constraint, state transitions, and UI remain missing |
| M6 — payments/invoices | Partial | Existing Decimal models and generic tenant-record endpoints | Central payment service, idempotency, derived balances, and UI remain missing |
| M7 — dashboard | Partial | Existing dashboard summary is verified tenant-scoped in e2e | Occupancy, arrivals/departures, and payment reconciliation remain missing |
| M8 — end-to-end proof and hardening | Not started | None | Playwright full flow, additional service tests, 60% coverage target, and manual QA run remain missing |
| M9 — CI and repo controls | Partial | `.github/workflows/ci.yml` has the requested job groups and coverage floor 10; local empty-DB migration and drift check pass | Hosted CI/PR result, hooks/templates, and branch protection are not verified |
| M10 — provider/offline seams | Partial | Shared client interfaces exist | Injection contracts, offline ADR, receipt-share documentation, and provider-network audit remain missing |

**Furthest milestone complete in sequence:** none. M0 remains partial, so no later milestone can be marked complete.

## Commands and results

- Fresh temp clone: `git clone --local --branch fix/batch-1-foundation C:\src\hotel-business-manager <temp-path>` then `corepack pnpm install --frozen-lockfile` — passed with pinned pnpm 9.15.0. Required build scripts ran; pnpm ignored only optional `unrs-resolver`.
- `corepack pnpm build` — passed; API and Next.js production build completed.
- `corepack pnpm lint` — passed; no ESLint warnings/errors.
- `corepack pnpm --dir apps/api exec jest --coverage --ci --runInBand` — passed, 8 suites / 26 tests, 10.67% statements. Jest and CI floor is 10%, rounded down from measured coverage (previous floor 9%).
- `corepack pnpm --filter api test:e2e:auth` — passed, 1 suite / 5 tests.
- With `TENANT_TEST_DATABASE_URL` and `DATABASE_URL` set to local Postgres: `corepack pnpm --filter api test:e2e` — passed, 2 suites / 14 tests; tenant suite uses real Postgres (not a Prisma mock).
- Fresh database `hotel_manager_batch1_empty`: `prisma migrate deploy` applied all 9 migrations; `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code` reported `No difference detected.`
- Playwright — not run; no config/spec exists.

## Decisions

See [DECISIONS.md](DECISIONS.md) for password policy, Decimal money, camelCase `businessId`, ActivityLog backfill/nullability, and models without independent CRUD routes.

## Manual owner follow-ups

- Review the pushed branch and open a PR. GitHub CLI is unavailable; branch protection and hosted CI remain unverified. See [REPO-SETTINGS.md](REPO-SETTINGS.md).
- Complete the remaining milestones and run Playwright before describing the project as ready for real-world testing.
