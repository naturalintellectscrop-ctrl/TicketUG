# ADR 008: Payment provider boundary

## Decision
Keep the payment domain provider-neutral. `PaymentProviderAdapter` owns provider initiation, signature verification, replay evidence, and event normalization. The application persists only normalized payment state and safe provider references.

## Rationale
No provider has been approved or configured. Introducing one would create an unapproved compliance and operational dependency. A non-production test adapter makes deterministic unit and contract testing possible without representing fake money.

## Consequences
Live payment requires an approved provider, adapter, secrets, webhook raw-body configuration, reservation/expiry policy, and database-backed certification. Browser redirects remain informational and cannot establish payment success.
