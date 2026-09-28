# Product and implementation decisions

- Registration requires a password of at least 12 characters, matching the documented administrator setup policy. The DTO enforces this for self-service registration.
- Money continues to use Prisma `Decimal` columns (`Decimal(12,2)`); amounts are not represented as floating point.
- Prisma and SQL retain camelCase `businessId`; no `business_id` mapping is used.
- Booking date ranges, when the booking engine is implemented, use half-open `[checkIn, checkOut)` ranges so same-day turnover is allowed. Checkout must follow check-in; cancelled/no-show bookings do not block rooms. The transition defaults are recorded in the task request; this behavior is not implemented yet.
- Activity log context can be ambiguous for a user with multiple business memberships. No `businessId` migration was added in this batch; the value must be set from the action context when activity logging is implemented, and only genuinely global events may remain null.
