# Production dependency audit findings

**Observed:** 2026-10-20 using `corepack pnpm audit --prod --audit-level high`
**Result:** 29 production dependency findings: 2 critical, 10 high, 15 moderate,
and 2 low. This document records all 29 advisories reported by the command.
The audit command and exact resolved versions should be rerun
before release because advisory data changes over time.

## High and critical advisories

| Severity | Package / resolved version                                   | Advisory            | Finding                                                           | Patched version reported |
| -------- | ------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------- | ------------------------ |
| Critical | `next` 14.2.35                                               | GHSA-p293-qw3h-jr36 | Unauthenticated RCE on Windows-hosted servers                     | 15.5.24 or later         |
| Critical | `next` 14.2.35                                               | GHSA-2xp9-vwfh-vxw4 | Unauthenticated RCE in Image Optimization API with AVIF           | 15.5.24 or later         |
| High     | `next` 14.2.35                                               | GHSA-h25m-26qc-wcjf | Request deserialization DoS with insecure React Server Components | 15.0.8 or later          |
| High     | `next` 14.2.35                                               | GHSA-q4gf-8mx6-v5v3 | Server Components denial of service                               | 15.5.15 or later         |
| High     | `next` 14.2.35                                               | GHSA-8h8q-6873-q5fj | Server Components denial of service                               | 15.5.16 or later         |
| High     | `next` 14.2.35                                               | GHSA-c4j6-fc7j-m34r | SSRF with WebSocket upgrades                                      | 15.5.16 or later         |
| High     | `next` 14.2.35                                               | GHSA-36qx-fr4f-26g5 | Middleware/proxy bypass in Pages Router applications using i18n   | 15.5.16 or later         |
| High     | `next` 14.2.35                                               | GHSA-m99w-x7hq-7vfj | App Router Server Actions denial of service                       | 15.5.21 or later         |
| High     | `next` 14.2.35                                               | GHSA-89xv-2m56-2m9x | SSRF in Server Actions on custom servers                          | 15.5.21 or later         |
| High     | `next` 14.2.35                                               | GHSA-p9j2-gv94-2wf4 | SSRF in rewrites via attacker-controlled destination hostname     | 15.5.21 or later         |
| High     | `deepmerge-ts` 7.1.5 (via Prisma 6.19.3)                     | GHSA-ggr8-5vv4-36mx | Stack exhaustion from recursive object graphs                     | 8.0.0 or later           |
| High     | `source-map-js` 1.2.1 (via Next.js 14.2.35 / PostCSS 8.5.23) | GHSA-68fv-2mgg-jv7q | Event-loop denial of service via indexed source-map offsets       | 1.2.2 or later           |

## Moderate and low advisories

| Severity | Package / resolved version | Advisory            | Finding                                                                            | Patched version reported |
| -------- | -------------------------- | ------------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| Moderate | `@nestjs/core` 10.4.22     | GHSA-36xv-jgw5-4q75 | Improperly neutralizes special elements used by a downstream component (injection) | 11.1.18 or later         |
| Moderate | `file-type` 20.4.1         | GHSA-5v7r-6r5c-r473 | Infinite loop in ASF parser on malformed zero-size sub-header                      | 21.3.1 or later          |
| Moderate | `file-type` 20.4.1         | GHSA-j47w-4g3g-c36v | ZIP decompression-bomb DoS via `[Content_Types].xml`                               | 21.3.2 or later          |
| Moderate | `multer` 2.3.0             | GHSA-3pph-fpjx-jg34 | DoS via orphaned disk writes on aborted uploads                                    | 2.4.0 or later           |
| Moderate | `next` 14.2.35             | GHSA-h64f-5h5j-jqjh | Denial of service in Image Optimization API                                        | 15.5.16 or later         |
| Moderate | `next` 14.2.35             | GHSA-gx5p-jg67-6x7h | XSS in `beforeInteractive` scripts with untrusted input                            | 15.5.16 or later         |
| Moderate | `next` 14.2.35             | GHSA-9g9p-9gw9-jx7f | DoS via Image Optimizer `remotePatterns` configuration                             | 15.5.10 or later         |
| Moderate | `next` 14.2.35             | GHSA-wfc6-r584-vfw7 | Cache poisoning in React Server Component responses                                | 15.5.16 or later         |
| Moderate | `next` 14.2.35             | GHSA-ffhc-5mcf-pf4q | XSS in App Router applications using CSP nonces                                    | 15.5.16 or later         |
| Moderate | `next` 14.2.35             | GHSA-68g3-v927-f742 | Cache confusion for requests with bodies                                           | 15.5.21 or later         |
| Moderate | `next` 14.2.35             | GHSA-4633-3j49-mh5q | Cache confusion for request bodies with invalid UTF-8                              | 15.5.21 or later         |
| Moderate | `next` 14.2.35             | GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in rewrites                                                 | 15.5.13 or later         |
| Moderate | `next` 14.2.35             | GHSA-955p-x3mx-jcvp | Unauthenticated disclosure of internal Server Function endpoints                   | 15.5.21 or later         |
| Moderate | `next` 14.2.35             | GHSA-3x4c-7xq6-9pq8 | Unbounded Image Optimizer disk-cache growth                                        | 15.5.14 or later         |
| Moderate | `next` 14.2.35             | GHSA-4c39-4ccg-62r3 | Unbounded Server Action payload in Edge runtime                                    | 15.5.21 or later         |
| Low      | `next` 14.2.35             | GHSA-vfv6-92ff-j949 | Cache poisoning via React Server Component cache-busting collisions                | 15.5.16 or later         |
| Low      | `next` 14.2.35             | GHSA-3g8h-86w9-wvmq | Middleware/proxy redirect cache poisoning                                          | 15.5.16 or later         |

## Disposition

These findings are documented, not remediated in this change. The reported
Next.js fix requires moving from the current 14.x major line to 15.5.24 or
later; that upgrade needs application compatibility review and its build and
browser tests. The Prisma and source-map findings are transitive and also need
dependency-resolution review. No compatibility or security exception is
implied by this document.

At the time of this historical audit, CI ran the high-severity audit and these
findings were unresolved. The package versions and CI workflow have since
changed; this section preserves the earlier record rather than describing the
current audit state.

## Current audit result

**Observed:** 2026-11-15 using `pnpm audit --prod` and
`pnpm audit --prod --audit-level high` after installing the locked workspace.
**Result:** no known production vulnerabilities. The direct Zod dependency was
upgraded to the patched 4.6.6 line, Express to 4.22.3, and the workspace
overrides now resolve vulnerable `body-parser` versions to 1.20.9 and `qs`
versions to 6.16.1. The lockfile was regenerated and both audit commands
passed. No advisory allowlist is used.
