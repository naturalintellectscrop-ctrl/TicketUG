# ADR 008: Payment provider boundary

## Decision
Keep the payment domain provider-neutral. `PaymentProviderAdapter` owns provider initiation, signature verification, replay evidence, and event normalization. The application persists only normalized payment state and safe provider references.

## Rationale
> **UPDATE 2026-09-30:** NylonPay was approved and integrated through this boundary (`c69e968`). The rationale below is retained as the original decision record; the registry-based selection it describes is exactly how NylonPay was added.

No provider had been approved or configured at decision time. Introducing one would create an unapproved compliance and operational dependency. A non-production test adapter makes deterministic unit and contract testing possible without representing fake money.

## Consequences
Live payment requires an approved provider, adapter, secrets, webhook raw-body configuration, reservation/expiry policy, and database-backed certification. Browser redirects remain informational and cannot establish payment success.
