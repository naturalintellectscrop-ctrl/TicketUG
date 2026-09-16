# Phase 9 — Secure ticket issuance

TicketUG now creates one immutable digital ticket per purchased quantity only inside the verified Phase 8 `SUCCEEDED` payment transaction. Issuance locks the paid order, expands every `order_item.quantity`, stores stable event and ticket-type snapshots, and records a unique issuance event so retries return the existing set rather than duplicating tickets.

Tickets use opaque public references plus cryptographically random credentials. The QR payload is `ticketug:v1:<credential>` and contains no personal, payment, status, or internal database data. The credential is an admission reference only; a future scanner must submit it to the backend for event assignment, current status, and check-in validation.

Authenticated access is scoped through the order owner. Guest access uses the existing `x-order-access-token` hash. Organizer visibility is resolved through event ownership and active owner/manager membership. No public ticket mutation, check-in, transfer, refund, or offline acceptance is included.

Migration `009-tickets.sql` has been added but is not applied by this change. Database concurrency, migration application, and end-to-end verified-provider issuance remain unverified without a non-production test database and live provider.
