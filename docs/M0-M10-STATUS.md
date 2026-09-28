# M0–M10 implementation status

This report covers the Batch 3 branch `feat/batch-3-money-reporting`, based on `release/m0-m10` after merging Batch 2. It is not a real-world-testing readiness claim; hosted CI and several earlier milestones remain incomplete.

| Milestone | Status (Complete / Partial / Not started) | Evidence | Remaining gaps |
|---|---|---|---|
| M0 — setup and runtime | Partial | Root `package.json` pins pnpm 9.15.0; env validator and health unit/e2e tests exist; final frozen install/build results recorded below | README setup was not replayed end-to-end; direct installed `pnpm` is 11.19.0, so use `corepack pnpm`; workspace build-script approval is only in lock/workspace state and should be confirmed on hosted CI |
| M1 — auth | Partial | `apps/api/test/auth.e2e-spec.ts` covers throttling, expiration, logout revocation; `apps/api/src/auth/auth.service.spec.ts` verifies hashed refresh storage; env validation unit specs | M0 is partial, so sequence status cannot be complete; hosted workflow not yet observed |
| M2 — tenant safety | Partial | Real Postgres `apps/api/test/tenant-isolation.e2e-spec.ts` covers tenant resources and booking/invoice/payment access; `apps/api/src/tenant-schema-coverage.spec.ts` guards every `businessId` model; dashboard cross-tenant occupancy check added | M0–M1 remain partial; `CatalogCategory`, `BusinessMember`, `SaleItem`, and stock movements have no independent CRUD, so coverage is through parent/list routes |
| M3 — customers | Partial | `customers.service.spec.ts` derives Decimal balance from partial invoices and excludes VOID invoices; customer profile uses returned derived invoice balances and booking history | Earlier M0–M2 milestones remain partial |
| M4 — properties and rooms | Partial | Real Postgres booking e2e exercises property/room list/create; existing property and room screens remain in the web app | Earlier milestones are incomplete; Playwright property/room flows not run |
| M5 — bookings | Partial | `bookings.service.spec.ts`, `bookings.e2e-spec.ts`: overlap/concurrency, raw SQL constraint, turnover, cancellation, Lagos DATE round-trip, repricing policy, active-delete protection, maintenance room rejection, transition races and atomic room status | Earlier milestones remain partial; hosted CI not observed |
| M6 — payments and invoices | Partial | `payments.service.spec.ts` and real Postgres booking e2e cover row-lock payment recording, overpayment race, idempotent reference, derived invoice status/balance, immutable ledger and generic invoice mutation rejection; invoice page at `apps/web/src/app/(dashboard)/invoices/[invoiceId]/page.tsx` | Earlier milestones remain partial; legacy invoice amount/balance columns remain maintained compatibility snapshots; hosted CI not observed |
| M7 — dashboard | Partial | Fixed-date `dashboard.service.spec.ts` covers occupancy and zero-room edge; real Postgres e2e reconciles collected/outstanding with invoice payment history and verifies tenant scoping | Earlier milestones remain partial; broader accounting/reporting and hosted CI verification remain |
| M8 — end-to-end proof and hardening | Not started | No Playwright config/full-flow spec or manual QA run in this batch | Full register→dashboard Playwright flow, QA checklist run, broad service coverage and 60% touched-service target remain |
| M9 — CI and repo controls | Partial | `.github/workflows/ci.yml` runs explicit `--runInBand`; API statement floor raised from 13% to 18%; migrations, coverage, e2e and aggregate jobs remain configured | Hosted CI and required-check branch protection are not verified; no new hosted CI URL available |
| M10 — provider/offline seams | Partial | Not changed in this batch | Provider injection contracts, offline ADR and documented manual WhatsApp sharing remain outstanding |

**Furthest milestone complete in sequence:** none. M0 is partial, so no later milestone is marked complete.

## Commands and results

- `corepack pnpm install --frozen-lockfile` — final fresh-clone result to be recorded after pushing this commit; the installed `pnpm` command is 11.19.0, while `corepack pnpm --version` is 9.15.0.
- `corepack pnpm build` — final result to be recorded after all commits.
- `corepack pnpm lint` — final result to be recorded after all commits.
- `corepack pnpm --filter api exec jest --coverage --ci --runInBand` — 13 suites / 75 tests; measured 23.66% statements. CI/global statement floor is 18% (rounded down from the gated coverage run); booking service is 52.17% statements and payment service 56.00% statements, with configured per-file floors of 50% and 55%.
- `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/hotel_manager_batch3_test?schema=public'; $env:TENANT_TEST_DATABASE_URL=$env:DATABASE_URL; corepack pnpm exec jest --config ./test/jest-e2e.config.json --runInBand` — latest full run 3 suites / 27 tests passed against real local Postgres. The tenant spec uses `TENANT_TEST_DATABASE_URL`; auth e2e retains its existing Prisma mock.
- Empty database `hotel_manager_batch3_empty`: `corepack pnpm exec prisma migrate deploy` applied all 12 migrations; `corepack pnpm exec prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code` reported `No difference detected.`
- Playwright — not run; no Playwright configuration exists in this branch.

## Decisions

See [DECISIONS.md](DECISIONS.md) for date-only booking repricing, invoice financial derivation, Decimal money, dashboard occupancy, retail tender policy, and tenant model surfaces.

## Manual owner follow-ups

- Open the PR from `feat/batch-3-money-reporting` to `release/m0-m10` using the supplied GitHub PR URL after push.
- Confirm the PR's hosted `CI passed` aggregate and set it as the required `main` check with branch protection. `gh` is unavailable locally; see [REPO-SETTINGS.md](REPO-SETTINGS.md).
- Complete Playwright full-flow proof, manual QA run, and M8/M10 work before describing the app as ready for real-world testing.
