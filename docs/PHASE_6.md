# TicketUG Phase 6 — Ticket Types & Inventory

## Scope
Phase 6 adds organizer-owned ticket types attached to events, deterministic UGX pricing, capacity, sale windows, derived availability, APIs, organizer management UI, and public ticket presentation. Orders, reservations, checkout, payments, issuance, QR tickets, and check-in are intentionally excluded.

## Model
`ticketug.ticket_type` uses `price_minor_units bigint` (UGX has no fractional minor unit, but the integer representation prevents floating-point ambiguity), `currency` constrained to `UGX`, non-negative `capacity`, optional sale windows, `active`, and event-scoped ordering. There is no mutable sold counter and no reservation table in this phase.

## Availability
Availability is derived from active state, capacity, and the current time: `INACTIVE`, `BEFORE_SALE`, `ON_SALE`, `AFTER_SALE`, or `SOLD_OUT`. Since no order domain exists yet, capacity is the configured total inventory. Phase 7 must consume inventory with a transaction and row lock or an atomic conditional update; it must never use an unprotected read-then-decrement flow.

## Authorization
Ticket APIs resolve the event or ticket type from persisted database relationships, then authorize the authenticated profile through existing active `ORGANIZER_OWNER`/`ORGANIZER_MANAGER` membership. Client organizer IDs are only route selectors and never proof of ownership. Attendees and inactive members cannot administer ticket types.

## Migration
`docs/migrations/006-ticket-types.sql` is a forward-only SQL migration consistent with Phase 5. It has not been automatically applied to production. The repository still has no formal migration runner; application and fresh-database verification remain deployment responsibilities.

## APIs
- `GET /api/v1/events/:eventId/ticket-types`
- `POST /api/v1/events/:eventId/ticket-types`
- `GET /api/v1/ticket-types/:ticketTypeId`
- `PATCH /api/v1/ticket-types/:ticketTypeId`
- `POST /api/v1/ticket-types/:ticketTypeId/active`
- `DELETE /api/v1/ticket-types/:ticketTypeId` (deactivates; does not hard-delete)
- `GET /api/v1/public/events/:slug/ticket-types`

## UI
- `/organizer/:organizerId/events/:eventId/tickets`
- `/organizer/:organizerId/events/:eventId/tickets/new`
- Public event pages now present active ticket types without checkout actions.

## Phase 7 assumptions
Future order items must reference `ticket_type.id` or `public_id` plus an immutable price/currency snapshot and quantity. Before implementing order consumption, add a transaction-safe inventory operation and define whether capacity is reduced through an atomic conditional update or a locked inventory ledger. Never mutate historical ticket type facts to reconstruct an order.

## Certification
Phase 4.1 DB-backed security certification remains UNVERIFIED because TEST_DATABASE_URL is unavailable. No production database was reset or used for destructive testing.
