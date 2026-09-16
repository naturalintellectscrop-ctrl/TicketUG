# ADR 009: Verified payment to secure ticket issuance

## Decision

Ticket issuance is a server-side operation inside the same PostgreSQL transaction as the existing verified payment-success transition. It locks the order, checks `order.status = PAID` and `payment.status = SUCCEEDED`, expands quantities into individual rows, and records a unique issuance event.

## Consequences

Duplicate webhook delivery and operational retries are safe at the application/database boundary. Ticket QR data is an opaque stable credential; the backend remains authoritative and check-in is deliberately deferred. Refund/cancellation statuses are reserved for future state transitions without conflating `ISSUED` and `CHECKED_IN`.
