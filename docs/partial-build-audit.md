# Partial Build Audit

Audit date: 2026-10-05. Scope: current working tree (including pre-existing uncommitted changes). Read-only audit; this report is the only file created. Findings below are verified from source unless marked **Needs confirmation**. A `—` means no relevant evidence found in the inspected chain. The repository has no automated browser full-flow proof. Current unit tests passing do not establish UI/runtime completion.

## 1. Summary

| # | Area (module/page/endpoint) | Layer(s) affected (DB / API / Web / Tests) | What exists | What is missing | Evidence (file path:line) | Severity | Effort | Related milestone |
|---:|---|---|---|---|---|---|:---:|---|
| 1 | Dashboard → invoices | Web | Dashboard cards link to `/invoices` | No invoice index route exists; only invoice detail route, so collected/outstanding cards land on 404 | `apps/web/src/app/(dashboard)/dashboard/page.tsx:34-39`; `apps/web/src/app/(dashboard)/invoices/[invoiceId]/page.tsx:1` | High | S | M6 |
| 2 | Expense date range | API / Web | Expense query supports `from` and `to` | `to` is inclusive only at midnight, excluding later timestamps on the selected date; Prisma date-only behavior needs runtime confirmation | `apps/api/src/expenses/expenses.service.ts:14,20` | Medium | S | M9 |
| 3 | Expenses API and UI | Tests / Web | CRUD, categories, summary and list UI exist | No expense service/controller tests found; archive and add-category UI calls have no local catch/error feedback | `apps/api/src/expenses/expenses.service.ts:1-21`; `apps/api/src/expenses/expenses.controller.ts:1-20`; `apps/web/src/app/(dashboard)/expenses/page.tsx:6-7` | Medium | M | M9 |
| 4 | Activity log | API / Web / Tests | Tenant-scoped list endpoint capped at 100 | No UI consumer, pagination, event-writing call sites, or tests found; verify whether any logs are actually produced | `apps/api/src/activity-logs/activity-logs.controller.ts:17-24`; `apps/api/prisma/schema.prisma:414-425` | Medium | M | M9 |
| 5 | Dashboard setup checklist | Web | Owner checklist queries setup resources | Any failure collapses setup to `null`, silently hiding checklist; its stock completion logic marks stock done when any stockable item has stock (rather than all) | `apps/web/src/app/(dashboard)/dashboard/page.tsx:20-25` | Medium | S | M7 |
| 6 | Dashboard sales/custom range | Web / Tests | Summary API and date controls exist | UI accepts reversed/incomplete custom ranges without feedback; one service unit spec exists but no dashboard browser tests | `apps/web/src/app/(dashboard)/dashboard/page.tsx:18,43`; `apps/api/src/dashboard/dashboard.service.spec.ts:1` | Medium | S | M7 / M8 |
| 7 | PWA mobile navigation | Web | Mobile bar links to home, sales, products, stock, expenses, receipts | Bar is not role/module filtered; staff links to ADMIN-only inventory and expenses; may show disabled/unavailable module screens | `apps/web/src/components/PwaShell.tsx:87-101`; `apps/api/src/inventory/inventory.controller.ts:12-14`; `apps/api/src/expenses/expenses.controller.ts:5` | High | S | M11 |
| 8 | PWA install prompt | Web | `beforeinstallprompt` captured and install button displayed | Event is typed `any`, no `appinstalled` handling; install capability/manifest behavior has no browser test | `apps/web/src/components/PwaShell.tsx:7,18-21,76-85`; `apps/web/public/manifest.json` | Low | S | M11 |
| 9 | Authentication route handling | Web | Auth boundary checks token and calls `/auth/me` | On initial pathname `/`, a failed `/auth/me` is swallowed and stale token is retained; protected route later clears it | `apps/web/src/components/auth-boundary.tsx:26-29,42-45` | Medium | S | M1 |
| 10 | Auth return-to path | Web | Login reads `returnTo` and redirects after auth | Needs confirmation: inspect/verify redirect allow-list; currently URL value is used as a navigation target | `apps/web/src/app/(auth)/login/page.tsx:35-37` | Medium | S | M1 |
| 11 | Auth/business onboarding | Web / Tests | Register, login and business creation screens/endpoints exist | No browser test covering register→business→dashboard; setup proof remains explicitly outstanding | `apps/web/src/app/(auth)/register/page.tsx:1`; `apps/web/src/app/(dashboard)/business/page.tsx:19`; `docs/M0-M10-STATUS.md:16,38` | High | M | M8 |
| 12 | Staff role enforcement | API / Web | ADMIN guards protect staff APIs; web hides owner pages for non-owner | Role is represented both as user role and business-member role; owner-only UI check keys off user role while service membership role is separate. Needs confirmation for non-admin business owners and managers | `apps/web/src/components/auth-boundary.tsx:11-13,33-36`; `apps/api/src/businesses/businesses.service.ts:18`; `apps/api/src/auth/business-context.guard.ts:1-80` | High | M | M2 |
| 13 | Staff screen | Web / Tests | Staff create/list/deactivate UI and API exist | No busy state for toggle; no dedicated tests found for business/staff service/controller | `apps/web/src/app/(dashboard)/staff/page.tsx:6`; `apps/api/src/businesses/businesses.controller.ts:25-27` | Medium | S | M9 |
| 14 | Products/catalog | Tests | Catalog CRUD, archive and module filtering used by UI | No catalog service/controller unit tests found; no product web tests | `apps/api/src/catalog/catalog.service.ts:1-48`; `apps/web/src/app/(dashboard)/products/page.tsx:1-230` | Medium | M | M8 |
| 15 | Customers | Tests / Web | Customer list/create/detail/archive and booking profile exist | No browser tests; customer list has no pagination (API is unpaginated); no explicit loading state found | `apps/api/src/customers/customers.service.ts:10-80`; `apps/web/src/app/(dashboard)/customers/page.tsx:1-190` | Medium | M | M8 |
| 16 | Sales | Web / Tests | Sale service creates sale, idempotency key, receipt fields and stock movement transactionally | No full browser test proves UI request/response, retry, stock and receipt chain; service unit tests cover only selected paths | `apps/api/src/sales/sales.service.ts:20-145`; `apps/web/src/app/(dashboard)/sales/page.tsx:1-440`; `docs/M0-M10-STATUS.md:16` | High | M | M8 |
| 17 | Retail money storage | DB / API / Web | Monetary values use Decimal with 2-decimal display and shared conversion utilities | Repo milestone explicitly plans migration to integer kobo; no kobo fields exist in Prisma schema | `apps/api/prisma/schema.prisma:228-250,272-299`; `packages/shared-types/src/money.js:1-20`; `docs/github-project-setup.ps1:58` | Medium | L | M8.5 Money to kobo |
| 18 | Inventory | Tests / Web | Stock-in/out/adjustment and sale deductions exist | No browser proof for opening stock→sale deduction; inventory UI error feedback for load/movement paths needs confirmation | `apps/api/src/inventory/inventory.service.ts:1-100`; `apps/web/src/app/(dashboard)/inventory/page.tsx:1-190`; `docs/M0-M10-STATUS.md:16` | High | M | M8 |
| 19 | Receipts | API / Web / Tests | Current working tree has receipt detail/list, public token page and PDF generation | New code is uncommitted; report covers it as currently present. No browser/e2e proof, no audited status for concurrent sequence generation beyond unit test, and business branding/cashier details may be incomplete | `apps/api/src/receipts/receipts.service.ts:1-120`; `apps/api/src/receipts/receipts.controller.ts:1-35`; `apps/web/src/components/ReceiptView.tsx:1-80`; `docs/github-project-setup.ps1:36-40` | High | M | M9 |
| 20 | Bookings | Tests / Web | Booking lifecycle, invoice and payment routes/screens exist | No browser booking flow tests; existing milestone status calls for Playwright/manual flow proof | `apps/api/src/bookings/bookings.controller.ts:1-80`; `apps/web/src/app/(dashboard)/bookings/page.tsx:1-300`; `docs/M0-M10-STATUS.md:12,38` | High | M | M8 |
| 21 | Payments/invoices | Web / Tests | API supports invoice creation, payment record/list, void; detail UI records payment | No invoice list/search UI, no browser flow proof; generic invoice mutation routes coexist with guarded financial endpoints and require careful policy review | `apps/api/src/payments/payments.controller.ts:9-18`; `apps/api/src/tenant-records/tenant-records.controller.ts:24-42`; `apps/web/src/app/(dashboard)/invoices/[invoiceId]/page.tsx:1-40` | High | M | M6 / M8 |
| 22 | Properties/rooms | Tests / Web | Property and room CRUD screens/routes exist | No browser test; staff path restriction and property ownership/business tenancy link need end-to-end verification | `apps/api/src/properties/properties.controller.ts:1-60`; `apps/api/src/rooms/rooms.controller.ts:1-70`; `docs/M0-M10-STATUS.md:11` | Medium | M | M4 / M8 |
| 23 | Activity/audit writes | DB / API | ActivityLog model and list endpoint exist | Search found no create/write calls; feature appears read-only/empty unless populated externally | `apps/api/prisma/schema.prisma:414-425`; `apps/api/src/activity-logs/activity-logs.controller.ts:17-24` | Medium | M | M9 |
| 24 | Pagination | API / Web | Booking DTO/API supports page/pageSize | Customers, catalog, sales, expenses and activity lists return unbounded rows or fixed first 100; frontend exposes no pagination | `apps/api/src/bookings/dto/list-bookings.dto.ts:1-30`; `apps/api/src/customers/customers.service.ts:10-25`; `apps/api/src/catalog/catalog.service.ts:10-25`; `apps/api/src/sales/sales.service.ts:155-185`; `apps/api/src/expenses/expenses.service.ts:12-16`; `apps/api/src/activity-logs/activity-logs.controller.ts:17-24` | Medium | M | M9 |
| 25 | UI error/loading/empty states | Web | Some pages have error handling and empty messages | Several screens have no explicit loading state; expense archive/category actions reject without catch; no common request cancellation/retry behavior | `apps/web/src/app/(dashboard)/expenses/page.tsx:6-7`; `apps/web/src/app/(dashboard)/staff/page.tsx:6`; `apps/web/src/lib/api.ts:3-18` | Medium | M | M9 |
| 26 | Missing feature tests | Tests | API tests exist for auth, bookings, payments, sales, inventory, rooms, properties, customers, dashboard, receipts | No tests found for businesses, catalog, expenses, activity logs, tenant-records, web pages, or full retail UI flow | `apps/api/src/**/*.spec.ts`; `apps/web/src` (no test files); `apps/api/test` | Medium | L | M8 / M9 |
| 27 | Money package JS compile warning | Tests / shared | Shared money helper has JS implementation and declaration | Jest warns `.js` compiled while `allowJs` is false; transpilation configuration is inconsistent | `packages/shared-types/src/money.js:1`; `packages/shared-types/src/money.d.ts:1`; API test output | Low | S | M8.5 |
| 28 | Sales price hook dependency | Web | Sales computes price choices with `useMemo` | Lint warns missing `priceFor` dependency, so memoized data may become stale if function behavior changes | `apps/web/src/app/(dashboard)/sales/page.tsx:82` | Low | S | M9 |
| 29 | M8 end-to-end proof | Tests | API unit and real-Postgres e2e suites exist in repository | No Playwright config/full browser-flow spec; manual QA not completed per current milestone record | `docs/M0-M10-STATUS.md:16,38-40`; `.github/workflows/ci.yml:1-200` | High | L | M8 |
| 30 | M9 hosted CI/repo controls | Tests / Config | CI workflow defines gates | Hosted run and required branch protection are not verifiable from local repository | `docs/M0-M10-STATUS.md:17,32-37`; `.github/workflows/ci.yml` | Medium | S | M9 |
| 31 | M10 online payment providers | API / DB / Web | Manual cash/transfer/POS recording exists | No Paystack/Flutterwave initialization, verified webhook, idempotent event ledger or provider configuration found | `apps/api/src/payments/payments.controller.ts:9-18`; `apps/api/prisma/schema.prisma:380-412`; `docs/github-project-setup.ps1:62-65` | Medium | L | M10 |
| 32 | M12 offline transactions/sync | API / DB / Web | Shell service worker caches manifest/icons only | No IndexedDB transaction store, sync queue or backend sync endpoint found | `apps/web/public/sw.js:1-45`; `docs/github-project-setup.ps1:68-71` | Low | L | M12 |
| 33 | M13 notifications | API / DB | No notification service or event queue found | WhatsApp/SMS notifications and per-business settings absent | `apps/api/src/app.module.ts:1-40`; `docs/github-project-setup.ps1:73-76` | Low | L | M13 |
| 34 | M14 subscriptions | DB / API / Web | No subscription/plan model or billing enforcement found | Plans, lifecycle and server-side limits absent | `apps/api/prisma/schema.prisma:92-425`; `docs/github-project-setup.ps1:78-81` | Low | L | M14 |
| 35 | Prisma model route reachability | DB / API / Tests | Tenant schema coverage guard checks model inventory | Guard checks presence in a test inventory, not live read/write reachability per model; child tables rely on parent/list APIs | `apps/api/src/tenant-schema-coverage.spec.ts:4-17`; `docs/M0-M10-STATUS.md:10` | Medium | M | M2 |

### Scan and checks

- TODO/FIXME/HACK/XXX/not-implemented/coming-soon/dummy/lorem scan: no confirmed application TODO/stub markers found. `console.log` hits are seed and e2e diagnostic output. `mock` hits are test doubles, not production mock data. No skipped/empty tests found by the requested patterns.
- `any` exists in critical-ish paths (PWA install event, expenses query objects, existing tests); no blanket finding beyond identified areas.
- Prisma migrations: 15 migration directories present, including `20261005120000_receipts`; schema includes current receipt fields. The migration/schema diff could not be independently checked against a database in this audit.
- Environment variables referenced in app code (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TENANT_TEST_DATABASE_URL`, `API_PORT`, `NEXT_PUBLIC_API_URL`, `WEB_ORIGIN`, `API_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`) are represented across root/API `.env.example` files; no confirmed missing reference found.
- `corepack pnpm lint`: PASS with one React hook dependency warning (`sales/page.tsx:82`).
- `corepack pnpm --filter api test`: PASS, 15 suites / 87 tests; Jest emitted a `money.js`/`allowJs` warning.
- `corepack pnpm test -- --runInBand`: FAILS at pnpm option parsing (`Unknown option: 'runInBand'`); correct workspace command above passes.
- Build and live Postgres e2e were not run: build emits generated artifacts, and e2e requires a configured dedicated database. Existing milestone notes report prior builds/e2e on a different recorded revision; they are not re-verified against this working tree.
- Working tree was already dirty at audit start: receipt, sales, environment, schema, shared money, and other changes are present uncommitted. No application files were edited by this audit.

## 2. Module status

| Module | Status | Notes |
|---|---|---|
| Auth | Mostly done | API tests exist; browser onboarding and invalid-token root handling gaps remain. |
| Businesses / staff / settings | Partial | Endpoints/UI exist; no service tests; role representation and staff UI require verification. |
| Products / catalog | Partial | Main CRUD chain exists; no catalog tests or browser proof. |
| Customers | Partial | CRUD/profile chain exists; no pagination or browser tests. |
| Sales | Partial | API transaction and UI exist; retail end-to-end proof absent. |
| Inventory | Partial | API/UI and unit tests exist; opening stock→sale chain lacks browser proof; admin-only access conflicts with mobile nav. |
| Receipts | Partial | Current working tree has service/API/UI/PDF/public receipt; uncommitted and not browser-verified. |
| Properties / rooms | Mostly done | APIs, UI and service tests exist; no browser flow proof. |
| Bookings | Mostly done | Strong service and real-Postgres tests; no browser flow proof. |
| Payments / invoices | Partial | API/detail page exist; invoice index missing and full browser proof absent. |
| Expenses | Partial | CRUD implementation exists; no service tests; date filtering and action feedback gaps. |
| Dashboard / reports | Partial | Summary exists with service tests; setup indicator and custom-range behavior incomplete. |
| Activity logs | Stub only | Tenant list endpoint and model exist; no app write path found. |
| PWA | Partial | Manifest/shell and service worker exist; mobile navigation access is inconsistent. |
| Provider payments | Not started | Manual payment entry only; provider/webhooks absent. |
| Offline sync | Not started | No local transaction queue or sync API. |
| Notifications | Not started | No service/queue/config found. |
| Subscriptions | Not started | No plan model/enforcement found. |
| Shared money | Partial | Decimal money helpers work in tests but JS transform warning; integer kobo migration remains planned. |

## 3. Core-flow check

| Step | Today? | Break / evidence |
|---|---|---|
| Login | Yes, API/UI implemented | API unit/e2e coverage exists; no full browser proof. |
| Create product | Yes, API/UI implemented | Catalog service/controller and product page connect; no catalog/browser tests. |
| Create customer | Yes, API/UI implemented | Customer create endpoint and page connect. |
| Make a sale | Needs confirmation | Service and page connect; no browser test demonstrates auth, selected product/customer, request and successful response as one flow. |
| Stock reduces | Needs confirmation | Sale service writes stock movements transactionally; no browser proof that stockable item path reaches completion. |
| Receipt shows | Needs confirmation | Current uncommitted receipt service and UI exist, but no full-flow browser proof. |

Overall: **No verified end-to-end answer** for a user completing the whole sequence today without errors. Static code supports the flow, but it is not demonstrated against the current working tree.

## 4. Recommended fix order

1. **Block the obvious broken invoice destination:** add invoice index/search/list route and wire dashboard cards. Batch with payment UI usability; M6.
2. **Prove and secure core retail flow:** browser test login→product/customer→sale→stock decrement→receipt, then close any observed failures. Include receipt changes currently in the dirty tree; M8/M9.
3. **Resolve access consistency:** filter PWA links by role/module or implement matching authorization; verify owner/member role mapping and manager behavior; M2/M11.
4. **Finish admin CRUD quality:** add tests for expenses/catalog/business/staff/activity; catch expense archive/category action failures, validate date range, add loading/busy states; M9.
5. **Improve scale and auditability:** pagination for customer/catalog/sales/expenses/activity; add ActivityLog write calls or confirm intentional external writer; M9.
6. **Complete money transition deliberately:** fix JS/TS Jest transform warning and plan/test decimal-naira→integer-kobo migration with reconciliation; M8.5.
7. **Milestone backlog:** provider webhooks/idempotency M10; PWA mobile install/navigation proof M11; offline queue/sync M12; notifications M13; subscriptions M14.

## 5. GitHub issues

Labels below use the repository's `docs/github-project-setup.ps1` label set (`priority:*`, `type:*`, `area:*`).

```text
[high] [Dashboard/Invoices] Add invoice index and repair dashboard invoice links — priority:high,type:feature,area:frontend,area:backend (M6)
[medium] [Expenses] Fix inclusive date filtering and validate range — priority:medium,type:bug,area:backend (M9)
[medium] [Expenses] Add service tests and report async action failures — priority:medium,type:bug,area:frontend,area:backend (M9)
[medium] [Activity] Add log write paths and paginated activity UI or remove dead endpoint — priority:medium,type:feature,area:backend (M9)
[medium] [Dashboard] Correct stock setup completion and expose setup-load errors — priority:medium,type:bug,area:frontend (M7)
[medium] [Dashboard] Validate custom date range and add browser coverage — priority:medium,type:bug,area:frontend (M8)
[high] [PWA Navigation] Align mobile navigation with role and enabled modules — priority:high,type:bug,area:pwa,area:frontend (M11)
[low] [PWA Install] Type install event and verify install lifecycle — priority:low,type:refactor,area:pwa,area:frontend (M11)
[medium] [Auth] Clear invalid session from root route — priority:medium,type:bug,area:auth,area:frontend (M1)
[medium] [Auth] Verify and constrain login return destination — priority:medium,type:bug,area:auth,area:frontend (M1)
[high] [Core Flow] Add browser onboarding and retail full-flow proof — priority:high,type:feature,area:frontend,area:backend (M8)
[high] [Authorization] Verify business member role mapping and owner page access — priority:high,type:bug,area:auth,area:backend (M2)
[medium] [Staff] Add toggle busy state and service/controller tests — priority:medium,type:feature,area:frontend,area:backend (M9)
[medium] [Catalog] Add API and browser tests for product CRUD — priority:medium,type:feature,area:backend,area:frontend (M8)
[medium] [Customers] Add pagination, loading state and browser coverage — priority:medium,type:feature,area:backend,area:frontend (M8)
[high] [Sales] Prove sale idempotency, UI completion, stock deduction and receipt — priority:high,type:feature,area:backend,area:frontend,area:database (M8)
[medium] [Money] Migrate monetary storage to integer kobo with reconciliation — priority:high,type:refactor,area:database (M8.5 Money to kobo)
[high] [Inventory] Prove opening stock and sale deduction in browser flow — priority:high,type:feature,area:backend,area:frontend (M8)
[high] [Receipts] Verify current receipt work end to end and complete receipt details — priority:high,type:feature,area:backend,area:frontend (M9)
[high] [Bookings] Add browser flow tests for booking lifecycle and invoice — priority:high,type:feature,area:frontend,area:backend (M8)
[high] [Payments] Add invoice listing and verify financial route policy — priority:high,type:feature,area:frontend,area:backend (M6)
[medium] [Properties/Rooms] Add browser flow proof and verify tenant ownership — priority:medium,type:feature,area:frontend,area:backend (M8)
[medium] [Activity] Add tenant-scoped activity creation and tests — priority:medium,type:feature,area:backend,area:database (M9)
[medium] [API Lists] Add pagination to unbounded tenant list endpoints — priority:medium,type:feature,area:backend,area:frontend (M9)
[medium] [Forms] Add consistent loading/error states to async admin actions — priority:medium,type:bug,area:frontend (M9)
[medium] [Test Coverage] Add missing module tests and web test harness — priority:medium,type:feature,area:backend,area:frontend (M8/M9)
[low] [Shared Money] Align shared JS helper with Jest TypeScript transform — priority:low,type:refactor,area:backend (M8.5)
[low] [Sales UI] Resolve missing priceFor hook dependency warning — priority:low,type:bug,area:frontend (M9)
[high] [M8 Proof] Complete Playwright full-flow and manual QA evidence — priority:high,type:feature,area:frontend,area:backend (M8)
[medium] [M9 CI] Verify hosted aggregate check and required branch protection — priority:medium,type:documentation,area:backend (M9)
[medium] [Payments] Implement provider initialization, signed webhooks and event idempotency — priority:high,type:feature,area:payments,area:backend,area:database (M10)
[low] [Offline] Build IndexedDB transaction queue and tenant-safe sync — priority:medium,type:feature,area:offline,area:frontend,area:backend (M12)
[low] [Notifications] Add notification abstraction and business channel settings — priority:low,type:feature,area:backend (M13)
[low] [Subscriptions] Add persisted plans and server-side lifecycle limits — priority:low,type:feature,area:backend,area:database (M14)
[medium] [Tenant Isolation] Verify live model reachability beyond schema inventory — priority:medium,type:feature,area:backend,area:database (M2)
```

## Counts and first fixes

Counts from the 35 summary rows: **Blocker 0 · High 10 · Medium 19 · Low 6**. No Blocker is asserted because the identified access and end-to-end concerns require runtime/role-path confirmation; the mobile admin links are a visible access mismatch but APIs deny non-admin access.

Top five fixes: (1) invoice index/dashboard links, (2) browser-prove the full retail sale→stock→receipt flow, (3) reconcile role/module access in PWA navigation and server guards, (4) expense action error handling/date filtering/tests, (5) establish missing module coverage and pagination for growing tenant lists.
