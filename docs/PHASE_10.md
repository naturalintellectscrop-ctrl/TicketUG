# TicketUG Phase 10

## Status
Implemented with environment verification limitations. The scanner foundation is server-authoritative and online-only.

## Audit and decisions
- Authentication, Neon Auth context, raw `pg`, ticket issuance, QR format, and organizer membership authorization: RETAINED.
- Event staff assignment and check-in records: BUILT because no existing tables or services were present.
- Ticket validation and atomic check-in: BUILT as a reusable NestJS service and matching Next.js proxy path.
- Scanner UI: BUILT at `/scanner` with assigned-event loading, camera permission capability handling, and manual entry fallback.

## Flow
`ticketug:v1:<credential>` is parsed server-side, hashed, and resolved to a ticket. The ticket row is locked in a PostgreSQL transaction. Only `ISSUED` tickets transition to `CHECKED_IN`; the check-in row has a unique `ticket_id` constraint. Replays return `ALREADY_CHECKED_IN` and do not create another record.

Scanner access is authenticated and event-scoped. `EVENT_STAFF` requires an active `event_staff_assignment`; organizer owners/managers and platform administrators follow the existing privileged role policy. The browser never supplies scanner identity or ticket validity.

## API
- `GET /api/v1/check-ins/events` — assigned events.
- `POST /api/v1/check-ins/events/:eventId/scan` — atomic scan/check-in.
- `GET /api/v1/check-ins/events/:eventId/summary` — derived check-in counts and recent check-ins.
- Next.js proxy: `GET/POST /api/check-ins` for the scanner surface.

## Offline policy
TicketUG Phase 10 uses server-authoritative online validation. Offline acceptance is intentionally not implemented. Network or verification failures never accept a ticket.

## Database
Migration: `docs/migrations/010-check-in.sql`. It was not applied to production or a test database. `TEST_DATABASE_URL` was unavailable, so PostgreSQL integration, authorization, and concurrency tests remain unverified.

## Verification
Passed: TypeScript typecheck, ESLint, Next.js production build, diff validation, and browser route verification. Browser verification confirmed the scanner route renders and safely reports no assigned events in the current environment. Blocked/unverified: live scan, migration application, and simultaneous database-backed check-in attempts.

## Scope exclusions
No offline acceptance, payment changes, scanner device management, refunds, check-in override, or Phase 11 functionality was added.
