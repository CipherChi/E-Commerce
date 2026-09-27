# Tenant isolation response policy

Tenant-owned records that are absent from the authenticated user's business scope return **404 Not Found** for GET, PATCH, and DELETE. This is intentional: returning 403 would confirm that an identifier exists in another business and enable cross-tenant record enumeration. Do not change these scoped misses to 403 without an explicit security decision.

The real-Postgres coverage is in `apps/api/test/tenant-isolation.e2e-spec.ts`. It asserts 404 separately for all three methods across customers, properties, rooms, bookings, payments, and invoices, and verifies the target rows remain unchanged.
