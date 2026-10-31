# Production deployment

This application is a Next.js web service, an Express API, and PostgreSQL. The example Compose file builds non-root API/web images and runs PostgreSQL on a private Docker network. Terminate TLS in a trusted reverse proxy in front of the web and API services; do not expose PostgreSQL publicly. The Compose example binds HTTP service ports to loopback by default so a host proxy can reach them.

## Required configuration

Set these values in the deployment platform or a protected, untracked environment file. Do not commit secrets.

| Variable | Required value |
|---|---|
| `NODE_ENV` | `production` for both API and web containers. This enables Secure refresh cookies and production CSP behavior. |
| `DATABASE_URL` | PostgreSQL connection string for the API. For Compose, use service host `postgres`; URL-encode special characters in credentials. |
| `JWT_ACCESS_SECRET` | Strong random secret, distinct from the refresh secret. |
| `JWT_REFRESH_SECRET` | Separate strong random secret; never reuse the access secret. |
| `WEB_ORIGIN` | Exact public web origin including scheme and port if nonstandard, for example `https://app.example.com`. |
| `NEXT_PUBLIC_API_URL` | Browser-reachable API origin (and optional proxy prefix), for example `https://api.example.com` or `https://app.example.com/api`. This value is public and is also supplied as a web image build argument. |
| `TRUST_PROXY` | `false` when no trusted proxy forwards requests, or the positive number of trusted proxy hops. Use the actual topology; never use `true`. |

The example Compose deployment also needs `POSTGRES_PASSWORD`, `API_ORIGIN`, and public bind/build values. `API_ORIGIN` is the public API origin used by operators and the example topology. Set `REDIS_URL` for distributed rate limiting when running multiple API replicas. `SENTRY_DSN` is optional and only sends sanitized generic server-error events.

## SameSite cookies and domains

The refresh cookie uses `SameSite=Strict`, `HttpOnly`, `Secure` in production, and `Path=/auth`. The web and API should share the same registrable domain: `app.example.com` and `api.example.com` both belong to `example.com`. `app.example.com` and `api.other.net` do not share a registrable domain; browsers will not send the strict same-site refresh cookie on that cross-site request.

For separately registered domains, use a same-origin reverse-proxy path instead of calling the cross-site API directly. For example, expose the API to the browser at `https://app.example.com/api`, set `NEXT_PUBLIC_API_URL` to that value, route `/api/*` through the proxy to the Express service with the `/api` prefix removed, and rewrite the API's `Set-Cookie` path from `/auth` to `/api/auth` at the proxy. Keep the browser's `Origin` as the web origin and forward it unchanged. Confirm the proxy preserves credentialed requests and `Set-Cookie` headers.

## TLS and proxy trust

Terminate HTTPS at a managed load balancer/reverse proxy, redirect HTTP to HTTPS there, and prevent direct untrusted access to the containers. Configure the proxy to overwrite (not append untrusted client-supplied) `X-Forwarded-For` and `X-Forwarded-Proto`. Set `TRUST_PROXY` to the exact trusted-hop count so Express uses the real client IP for rate limits. The web app should be served over HTTPS so browsers accept its Secure refresh cookie. Restrict database access to application/backup networks and encrypt database volumes and backup storage according to the deployment platform's controls.

## First release and session invalidation

The auth migration changed refresh tokens from response-body values to HttpOnly cookies, so users with pre-deployment clients must sign in again. Plan a one-time session invalidation for the first release of this cookie-based flow. During a maintenance window, after deploying the schema and before reopening traffic, run once against the production database:

```sql
UPDATE "User"
SET "refreshTokenHash" = NULL,
    "tokenVersion" = "tokenVersion" + 1;
```

This invalidates existing access and refresh tokens for all accounts. Do not repeat this statement on routine deployments; it signs everyone out each time. Record the execution and timestamp in the release log.

## Deployment sequence

1. Provision PostgreSQL and Redis (if using shared throttling); create protected secrets and environment variables.
2. Build immutable API and web images. Set `NEXT_PUBLIC_API_URL` at web image build time to its browser-visible URL.
3. Back up the database and verify the backup artifact exists before changing schema.
4. Run `corepack pnpm --filter api exec prisma migrate deploy` as a one-off release job with the production `DATABASE_URL`; do not run development migrations in the serving container.
5. For the initial cookie-auth deployment only, run the session invalidation SQL above.
6. Start/roll out API and web services behind TLS. Verify `/health/live`, `/health/ready`, login/refresh/logout, CSP/security headers, and representative tenant-scoped workflows.
7. Monitor structured API logs, database health, rate-limit storage, and optional Sentry events. Keep the previous image available for rollback; database rollback may require a forward migration or restore.

Local production image instructions are in [`infra/docker-compose.prod.example.yml`](../infra/docker-compose.prod.example.yml). Database recovery is documented in [backup and restore](backup-restore.md).
