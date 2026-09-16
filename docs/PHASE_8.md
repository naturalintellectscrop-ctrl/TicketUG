# TicketUG Phase 8 — Payment Domain

## Scope
Phase 8 adds provider-neutral Payment, PaymentAttempt, and WebhookEvent persistence, payment initiation, verified webhook processing, and authoritative payment status. Ticket issuance, QR codes, refunds, settlements, payouts, and ledger accounting remain deferred.

## Provider gate
No production provider is selected or configured in the repository. The `test` adapter is available only outside production and requires `PAYMENT_TEST_WEBHOOK_SECRET`; production fails with `PROVIDER_NOT_CONFIGURED` until an approved adapter and credentials are added.

## State model
Payments and attempts use `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `EXPIRED`. Terminal states cannot transition. Orders gain `PAYMENT_PROCESSING`, `PAID`, and `EXPIRED` compatibility states; only verified server-side webhook evidence can mark an order paid.

## Security and idempotency
Payment initiation derives amount/currency from the Order and accepts only an idempotency key. Webhook events are unique by provider/event ID, signatures are verified by the adapter, payload amount/currency/order references are compared with locked database records, and duplicate events are harmless.

## Expiration and inventory
Phase 7 consumes inventory while payment is pending. No authoritative reservation duration was defined in the audited sources, so this phase adds expiry columns and states but does not invent an automated timeout or release policy. A future approved reservation policy must implement transactional, idempotent release before live payment launch.

## Fees
No finalized platform fee was found. Fee calculation is intentionally deferred.

## Required production configuration
- `PAYMENT_PROVIDER`: approved provider name
- Provider-specific secrets for the approved adapter
- `PAYMENT_TEST_WEBHOOK_SECRET` only for non-production adapter testing

## Future adapter
Implement `PaymentProviderAdapter`, register the provider, verify its raw webhook signature and replay evidence, normalize its events, and keep provider HTTP/signature details inside the adapter.
