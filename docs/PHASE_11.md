# TicketUG Phase 11 — Payment Boundary Certification

## Status

PARTIAL — PROVIDER SELECTION REQUIRED.

The repository retains its provider-neutral payment adapter architecture. No live provider was selected or implemented because no provider is formally approved in the repository.

## Hardening completed

- Webhook verification receives the exact raw request body through Express JSON verification middleware.
- Webhooks without a captured raw body are rejected.
- Test-provider webhook signatures use timestamped HMAC verification and constant-time comparison.
- Payment transitions allow authoritative `PENDING → SUCCEEDED` and reject unknown/terminal transitions.
- Webhook amount, currency, and order-reference mismatches have distinct validation failures.
- Provider contract tests cover valid signatures, altered bodies, malformed payloads, and missing configuration.
- Ticket issuance remains inside the verified webhook transaction and is not reachable through browser redirects.

## Provider gate

PROVIDER SELECTION REQUIRED. The `test` adapter remains non-production and is only available outside production. A provider name, sandbox credentials, webhook signing scheme, callback contract, and fee/custody decision are required before a live adapter can be implemented.

## Financial limitations

No refund, fee, settlement, ledger, reconciliation, or order-expiry policy was invented in this phase. The existing migration sequence (`008-payments.sql`, `009-tickets.sql`, `010-check-in.sql`) remains manually applied and environment-unverified.

## Verification limitations

`TEST_DATABASE_URL` is unavailable, so PostgreSQL transaction/concurrency verification is blocked. Live-provider sandbox verification is also blocked until a provider is approved and configured. The test adapter and provider-neutral unit tests can be run without production data.

## Security decisions

Payment success is established only by a verified server-side webhook. Client redirects cannot mark an order paid. Raw webhook signatures, provider secrets, QR credentials, and unnecessary payment data are not logged or exposed to clients.
