# Phase 9 audit

## Retain

Raw PostgreSQL/`pg`, Neon Auth, organizer memberships, Event/TicketType/Order/OrderItem, guest order tokens, and the provider-neutral Phase 8 payment boundary were retained.

## Build

Added the Ticket model, transactional issuance service, stable QR credential utility, attendee/guest/organizer read APIs, attendee ticket pages, and issuance documentation.

## Security review

Issuance has no client endpoint and is called only after the verified webhook marks both payment and order successful. Public IDs and credentials are random, owner and organizer queries are server-scoped, guest access is hash-scoped, QR payloads omit sensitive fields, and status/check-in mutations are absent.

## Constraints

The database trigger prevents tickets exceeding an order-item quantity, while `UNIQUE(order_item_id, unit_number)` and a unique payment-scoped issuance event prevent duplicate units and retries. Atomic/concurrent guarantees require applying migration 009 and running against a dedicated test database; those checks are UNVERIFIED here.
