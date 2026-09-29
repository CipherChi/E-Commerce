# M0–M10 implementation status

This report covers `feat/batch-3-money-reporting`, based on updated `release/m0-m10` (including Batch 2). Local gates passed on the final implementation. Hosted CI has not run because the PR is not open yet. The project is **not** ready for real-world testing: M8 proof is absent and earlier milestones remain partial.

| Milestone | Status (Complete / Partial / Not started) | Evidence | Remaining gaps |
|---|---|---|---|
| M0 — setup and runtime | Partial | Root `package.json` pins pnpm 9.15.0; env validation and health checks are covered by API unit/e2e tests; frozen install/build passed below | README setup was not replayed end-to-end; installed global pnpm is 11.19.0, so commands used Corepack; setup is not fully proven |
| M1 — auth | Partial | `apps/api/test/auth.e2e-spec.ts` covers throttling, token expiry and logout revocation; `apps/api/src/auth/auth.service.spec.ts` verifies hashed refresh storage; env validation unit specs | Hosted workflow not observed; broader authentication review remains |
| M2 — tenant safety | Partial | Real Postgres `apps/api/test/tenant-isolation.e2e-spec.ts`; `apps/api/src/tenant-schema-coverage.spec.ts` guards models with `businessId`; dashboard cross-tenant e2e | Some nested models (categories, line items, movements) are reached through parent/list operations rather than independent CRUD; hosted CI not observed |
| M3 — customers | Partial | `customers.service.spec.ts` derives Decimal outstanding balance across partial and VOID invoices; profile includes booking history | Earlier M0–M2 are partial |
| M4 — properties and rooms | Partial | Booking e2e exercises property/room creation and listing; property and room screens remain in the web app | Playwright property/room flows not run |
| M5 — bookings | Partial | `bookings.service.spec.ts` and real Postgres e2e cover overlap/concurrency, raw SQL exclusion constraint, turnover, cancellation, Lagos DATE round-trip, repricing, active-delete protection, non-bookable room rejection, transition races and room status | Hosted CI not observed; Playwright flow absent |
| M6 — payments and invoices | Partial | `payments.service.spec.ts` and real Postgres e2e cover row-lock payment recording, concurrent overpayment prevention, idempotent reference, derived invoice status/balance, immutable ledger and generic mutation rejection; invoice UI at `apps/web/src/app/(dashboard)/invoices/[invoiceId]/page.tsx` | Compatibility invoice amount/balance fields remain stored snapshots; hosted CI not observed |
| M7 — dashboard | Partial | Fixed-date `dashboard.service.spec.ts` tests occupancy including zero-room behavior; real Postgres e2e reconciles payment totals and checks tenant scope | Broader reporting and hosted CI verification remain |
| M8 — end-to-end proof and hardening | Not started | No Playwright configuration/full-flow spec or completed manual QA run | Register→dashboard browser flow, QA checklist run, broad service coverage and 60% touched-service target remain |
| M9 — CI and repo controls | Partial | `.github/workflows/ci.yml` has migration, build/lint, unit/coverage, Postgres e2e, audit and aggregate jobs; e2e is explicitly `--runInBand`; API global statement floor is 19% | Hosted CI and required-check branch protection are not verified; no hosted run URL |
| M10 — provider/offline seams | Partial | Retail receipt sharing and provider interfaces are present in the repo | Provider injection contract tests, offline ADR, and explicit WhatsApp manual-share documentation remain outstanding |

**Furthest milestone complete in sequence:** none. M0 is partial, so no later milestone is complete in sequence.

## Commands and results

Commands below ran on the final implementation commit `9fe0d51477b82dcfca0a5297d9c65df7d8a73185`; the report-only commit that follows does not change application code.

- Fresh-clone frozen install: in `C:\Users\CipherChi\AppData\Local\Temp\hotel-batch3-clone-629048fac88d40f2a5b8f94f38e8e9ac`, `corepack pnpm --version` returned `9.15.0`; `corepack pnpm install --frozen-lockfile` passed. pnpm reported only the existing ignored `unrs-resolver` build script; no install failure.
- `corepack pnpm build` — PASS (Nest API build and Next production build, including invoice page).
- `corepack pnpm lint` — PASS (no lint errors or warnings).
- From `apps/api`, `corepack pnpm exec jest --coverage --ci --runInBand` — PASS, 13 suites / 78 tests. Overall statement coverage was 25.75%; the effective global threshold denominator measured 19.11%, with the configured global floor at 19%. Booking service: 72.72% statements (Jest report; 88/121 statements); Payments service: 56.00% (42/75). Per-file floors are 50% and 55% respectively. Prior recorded overall coverage was 13.95%; the floor was raised from 13% to 19%, never lowered.
- Empty Postgres database `hotel_manager_batch3_final_empty`: from `apps/api`, `corepack pnpm exec prisma migrate deploy` — PASS, all 12 migrations applied. `corepack pnpm exec prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code` — PASS, `No difference detected.` The hand-written exclusion constraint is intentionally SQL-only; Prisma's schema diff does not model that constraint.
- Real Postgres API e2e database `hotel_manager_batch3_final_test`: migrations deployed; with `TENANT_TEST_DATABASE_URL` set to this database, `corepack pnpm exec jest --config ./test/jest-e2e.config.json --runInBand` — PASS, 3 suites / 28 tests, including real tenant isolation, booking and payment concurrency, and dashboard tenant assertions. Auth e2e continues to use its existing Prisma mock; the tenant-isolation spec does not mock Postgres.
- Playwright — NOT RUN; no Playwright configuration or full-flow spec exists on this branch.

## Decisions

See [DECISIONS.md](DECISIONS.md) for date-only booking repricing, invoice financial derivation, Decimal money, dashboard occupancy, retail tender policy, and tenant model surfaces.

## Manual owner follow-ups

- Create the PR from `feat/batch-3-money-reporting` to `release/m0-m10` using the supplied URL after push.
- Confirm the hosted `CI passed` aggregate and set it as the required `main` check with branch protection. `gh` is unavailable locally; see [REPO-SETTINGS.md](REPO-SETTINGS.md).
- Complete Playwright full-flow proof, run the manual QA script, and finish M8/M10 before calling the project ready for real-world testing.

