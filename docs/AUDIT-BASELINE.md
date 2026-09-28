# M0–M10 Baseline Audit

Date: 2026-09-28. Starting commit: `5ac8d32` (`codex/ambient-video-appwide`). Starting branch requested by task: `codex/ambient-video-appwide`. Baseline branch: `release/m0-m10` created at that commit. No tracked changes existed; pre-existing untracked `.github/` and `.vscode/` were present and preserved. `git log main..HEAD --oneline` contains only `5ac8d32 feat: expand hotel manager dashboard`.

## Baseline gates (before implementation changes)

- `pnpm install --frozen-lockfile`: failed, `ERR_PNPM_IGNORED_BUILDS`; host's globally selected pnpm is 11.19.0 and requires approval for dependency build scripts. `corepack pnpm --version` reports the repo-pinned 9.15.0. Frozen install reported lockfile current and packages already installed before failing on ignored build scripts.
- `corepack pnpm build`: started; API build completed and web production build was still running at audit capture. Final result must be appended after the process completes.
- `corepack pnpm lint`: passed, Next reports no ESLint warnings/errors.
- `corepack pnpm --filter api test -- --runInBand`: passed, 5 suites / 17 tests.
- Docker Compose Postgres 16 was already healthy at localhost:5432.
- Empty database migration/drift check: not yet run at baseline.
- Real Postgres tenant isolation: migration deploy and `test:e2e:tenant` started against the dedicated `hotel_manager_test` database with both `DATABASE_URL` and `TENANT_TEST_DATABASE_URL`; final result to append.

## Verified implementation state

- `.github/workflows/ci.yml` exists as pre-existing untracked content. It pins pnpm 9.15.0 and defines install/lint/build, empty Postgres migrations/drift, unit coverage, real Postgres API e2e, conditional Playwright, dependency audit, and aggregate `CI passed`. Coverage floor is 9%. Its presence differs from the older audit claim that no workflow exists.
- `apps/api/src/health.controller.ts` exposes `GET /health`, but it only returns `{status:"ok"}` and does not ping the database.
- Registration requires password length 12 in `apps/api/src/auth/dto/register.dto.ts`; `apps/api/test/auth.e2e-spec.ts` uses a shorter happy-path password and therefore conflicts with the policy. Auth e2e uses mocked Prisma.
- `apps/api/test/tenant-isolation.e2e-spec.ts` uses real Prisma/Postgres and refuses to run without `TENANT_TEST_DATABASE_URL`. It exercises cross-tenant get/update/delete for Customer, Property, Room, Booking, Payment, Invoice and customer list/search. It does not yet cover business modules, catalog, inventory, stock movements, sales, receipts, expenses, dashboard, or BusinessModule list/get/update/delete. Thus this differs from the stale summary: real-DB tenant spec is present, not never implemented.
- `User.refreshTokenHash` and `tokenVersion` exist in `apps/api/prisma/schema.prisma`; passwordHash is used. `main.ts` enables `whitelist`, `forbidNonWhitelisted`, and transform. No throttler dependency/rate limit was found in package metadata.
- `BookingStatus` has PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED; no NO_SHOW. Booking and payment/invoice models already exist; invoice stores mutable amountPaid/balance/status. Booking APIs remain generic tenant-record routes, without dedicated create/list/state-machine/overlap endpoints. Money columns use Prisma Decimal.
- `ActivityLog` has `userId` and no `businessId`; no activity-log query routes were found in source.
- The web app is under `apps/web/src/app` (not `apps/web/app`). No Playwright config/spec was found.

## Tenant model → routes → isolation coverage

Model inventory is from `apps/api/prisma/schema.prisma`. “Tenant route” means an HTTP route was found in a controller; “yes” means the real-Postgres spec explicitly exercises cross-tenant access, not merely that the model has a businessId column.

| Model | Routes / access | Isolation spec? |
|---|---|---|
| BusinessModule | business module settings through business controller | No |
| BusinessMember | created through business registration/onboarding service | No |
| Property | `/properties` CRUD | Yes (get/update/delete; list not tested) |
| Room | `/properties/:propertyId/rooms` CRUD | Yes (get/update/delete; list not tested) |
| Customer | `/customers` CRUD/search | Yes (get/update/delete/list/search) |
| CatalogCategory | `/catalog/categories` CRUD | No |
| Product | `/catalog/products` CRUD | No |
| StockMovement | `/inventory` product stock/history routes | No |
| Sale | `/sales` create/list/get/cancel routes | No |
| SaleItem | nested under Sale; no independent routes | No |
| ExpenseCategory | `/expenses/categories` routes | No |
| Expense | `/expenses` CRUD/summary | No |
| Booking | generic `/bookings/:id` routes only | Yes (get/update/delete; no create/list) |
| Payment | generic `/payments/:id` routes only | Yes (get/update/delete; no list route) |
| Invoice | generic `/invoices/:id` routes only | Yes (get/update/delete; no list route) |
| Business | `/businesses` onboarding/details/modules | Not in current spec |

## Gaps for subsequent batches

The required M0–M10 changes remain unimplemented at this baseline. Highest-risk gaps confirmed are boot-time env validation, DB-aware health, auth test correctness/token revocation cases/rate limiting, tenant-model coverage guard and retail isolation, booking engine and DB exclusion constraint, derived payment/invoice/customer balances, dashboard occupancy, Playwright flow, test coverage, hooks/templates, and M10 seam/provider documentation.

Baseline result updates:
- `corepack pnpm build`: pending web production build at last poll; API Nest build passed.
- `corepack pnpm lint`: passed.
- Real Postgres migration deploy applied all 7 migrations successfully to `hotel_manager_test`. Tenant e2e then failed: all 7 tests error during setup because registration returned 400; its password `tenant-test-password-123` is shorter than the 12-character DTO rule. This confirms the stale audit finding about auth/e2e policy mismatch, but also confirms the tenant spec is wired to real Postgres.
