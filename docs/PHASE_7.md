# TicketUG Phase 7 — Orders & Transactional Inventory

## Status
Phase 7 implements Order, OrderItem, guest and authenticated order creation, server-derived totals, historical snapshots, transactional inventory consumption, cancellation, and visibility foundations. Payment, payment attempts, refunds, settlement, ticket issuance, QR, and check-in remain outside this phase.

## Model
`ticketug.order` uses non-sequential UUID storage IDs, opaque `public_id`, unique human-readable `order_number`, optional `user_profile_id`, purchaser contact fields, hashed guest access token, `AWAITING_PAYMENT`/`CANCELLED` status, UGX total, and optional idempotency key. `ticketug.order_item` stores ticket type reference, quantity, ticket name snapshot, integer unit price snapshot, currency snapshot, and line total snapshot.

## Guest orders
Guest creation requires purchaser name/email and returns a one-time display of an opaque access token. Retrieval must use `X-Order-Access-Token`; public IDs alone are not credentials. The token is stored only as SHA-256 hash. Token delivery and authenticated verification through future payment/email infrastructure remain dependencies.

## Inventory transaction
Order creation begins a PostgreSQL transaction, locks every selected ticket type with `FOR UPDATE OF t` in deterministic public-identifier order, validates event/ticket eligibility, calculates server-side totals, conditionally decrements `remaining_capacity`, inserts the order and immutable items, and commits. Any failure rolls back all inventory and order writes.

Phase 6 capacity is copied into `remaining_capacity` by migration 007. The database check keeps remaining capacity between zero and configured capacity. Cancellation locks the order, restores each item quantity transactionally, then changes status once.

## Eligibility and state
Orders require a PUBLIC event in `SALES_OPEN`, an active ticket type, valid sale window, positive quantities, and sufficient remaining capacity. New orders are `AWAITING_PAYMENT`; only authenticated owner cancellation is implemented and moves to `CANCELLED`. No state implies payment success.

## Idempotency
Authenticated and guest requests accept an optional idempotency key. Database partial unique indexes scope keys to the authenticated profile or guest email. A full duplicate-response replay layer should be completed before payment integration if clients require the original guest token to be replayed.

## APIs
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:publicId`
- `PATCH /api/v1/orders/:publicId/cancel`
- `GET /api/v1/organizer/events/:eventId/orders`
- `POST /api/v1/public/orders/guest`
- `GET /api/v1/public/orders/:publicId` with `X-Order-Access-Token`

## UI
- `/events/:slug/order`
- `/account/orders`
- `/account/orders/:publicId`
- `/organizer/:organizerId/events/:eventId/orders`

## Future payment dependencies
Payment must reference the order as the commercial object, transition state only through verified provider callbacks, and never recompute totals from current TicketType data. Later phases must add payment records, webhook idempotency, refund policy, and ticket issuance without mutating these snapshots.

## Certification
Phase 4.1 database-backed certification remains UNVERIFIED because TEST_DATABASE_URL is unavailable. No production database was reset or used for destructive or concurrency testing.
