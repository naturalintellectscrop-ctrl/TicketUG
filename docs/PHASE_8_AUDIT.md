# Phase 8 Audit

- RETAIN: raw `pg`, DatabaseService transactions, Neon Auth, organizer ownership, Phase 7 orders and inventory.
- BUILD: payment tables, state rules, provider registry, test adapter, initiation, webhook boundary, and tests.
- REFACTOR: app module and auth public-route exceptions only.
- REPLACE: none.

Provider selection remains a business/compliance gate. No live provider was selected, no credentials were added, and no production payment flow is claimed ready.

Database migration `008-payments.sql` was created but not applied. `TEST_DATABASE_URL` is unavailable; migration execution, PostgreSQL locking, webhook concurrency, inventory expiry/release, and database idempotency remain unverified.

Known boundary: raw-body capture uses the request raw body when available and falls back to deterministic JSON serialization in the test boundary. A selected production adapter must configure framework-level raw-body capture before launch.
