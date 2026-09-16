# Phase 7 Audit

## Initial audit
The repository retained raw PostgreSQL via `pg`, the NestJS API, the Phase 5 event lifecycle, Phase 6 ticket types, existing membership authorization, manually tracked SQL migrations, and Next.js App Router pages. No order tables or order APIs existed.

## Decisions
- RETAIN existing database service transaction helper, event lifecycle, ticket type model, auth guard, memberships, and role model.
- COMPLETE Phase 6 inventory by adding transactional `remaining_capacity`.
- BUILD Order/OrderItem tables, service, controller, guest token boundary, UI, and tests.
- REFACTOR none of the established auth or event systems.
- REPLACE none.

## Security
Server-side prices, currency, totals, event state, ticket activity, and inventory are authoritative. Guest retrieval requires a hashed opaque access token. Authenticated orders are scoped by profile. Organizer event lists resolve ownership through persisted event membership. Public sequential IDs are not used.

Known limitations: API idempotency reuse does not replay the original guest token; payment/email delivery is not implemented; database-backed concurrency testing is unavailable.

## Verification limitation
UNVERIFIED — TEST_DATABASE_URL unavailable. Migration application, fresh database reproduction, cross-organizer integration tests, and real concurrency certification were not run. No production-destructive testing was performed.

## Boundary audit
No Payment, PaymentAttempt, webhook, Refund, Settlement, LedgerEntry, Ticket, QR, CheckIn, scanner, transfer, or resale implementation was added. Order status remains explicitly unpaid.
