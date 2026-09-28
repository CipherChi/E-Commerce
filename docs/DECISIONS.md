# Product and implementation decisions

- Registration requires a password of at least 12 characters, matching the documented administrator setup policy. The DTO enforces this for self-service registration.
- Money continues to use Prisma `Decimal` columns (`Decimal(12,2)`); amounts are not represented as floating point.
- Prisma and SQL retain camelCase `businessId`; no `business_id` mapping is used.
- Booking date ranges, when the booking engine is implemented, use half-open `[checkIn, checkOut)` ranges so same-day turnover is allowed. Checkout must follow check-in; cancelled/no-show bookings do not block rooms. The transition defaults are recorded in the task request; this behavior is not implemented yet.
- `ActivityLog.businessId` is nullable because historical events for users with multiple memberships cannot be reliably assigned to a business without action context. The migration backfills users with exactly one membership and only adds `NOT NULL` when a nonempty table has no remaining nulls. The activity list endpoint filters by the authenticated business; null/global events are not returned in tenant lists.
- Several tenant models have no independent CRUD API: `CatalogCategory` is currently an unused legacy model, `BusinessMember` is created by onboarding, `SaleItem` is nested in sales, and `StockMovement` is exposed only as product history. Cross-tenant tests exercise their parent/list surfaces where available and the schema guard requires each model to remain accounted for.
