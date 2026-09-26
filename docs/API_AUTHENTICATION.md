# API authentication boundary

TicketUG uses Neon Auth as the sole credential and session authority. The API boundary calls the same server-side Neon Auth session resolver used by Next.js, then maps the validated Neon Auth user ID to `ticketug.user_profile`, active organizer memberships, and platform roles.

The API must never trust `userId`, `role`, `organizerId`, or membership values from request bodies. Controllers receive an `ApiAuthContext` produced by `authenticateApiRequest`; authorization predicates then enforce resource scope.

## NestJS integration

The repository does not currently contain a NestJS service. `lib/api-auth.ts` is the framework-neutral contract for a future Nest guard. The future guard should call `authenticateApiRequest`, attach the context to the request, and use `requireApiRole` or domain predicates in the service layer. It must not create a second login, password, token, or session system.

Unauthenticated requests fail closed with `UNAUTHENTICATED`; authenticated users without the requested role fail with `FORBIDDEN`.

## System maintenance endpoints

`POST /api/v1/system/orders/expire-stale` is an operator/cron surface for the order expiry sweeper (expires unpaid reservations past `payment_expires_at` and restores ticket inventory). It does not use user sessions:

- Authenticate with the `x-cron-secret` request header; the value must equal the `CRON_SECRET` environment variable of the API deployment.
- The guard fails closed: if `CRON_SECRET` is unset, every `/api/v1/system/*` request is rejected with 401.
- Optional JSON body `{ "limit": 100 }` caps how many orders are expired per invocation (1–500). Response: `{ expiredCount, windowMinutes, orders: [...] }`.
- Schedule it externally (e.g. every 5 minutes) against the API deployment. Read paths (`payment status`, `initiate payment`) also expire single stale orders lazily, so correctness does not depend on the sweep alone.

Payment window duration is controlled by `PAYMENT_WINDOW_MINUTES` (default 15, clamped 1–120) on both the Next.js guest order path and the NestJS order path.
