# KYC / Business-Verification — Policy Decision Set

Status: DECISIONS REQUIRED — no implementation in this change. This document exists so
the owner can approve one option per decision; implementation is gated on those answers.
Grounded in the audited state: payment adapter, webhook verification, order state machine
and ticket issuance are complete; refunds/settlement/ledger are absent; payouts are an
external NylonPay-dashboard step; `/platform` is read-only end to end (app/platform/layout.tsx).

## 0. The separation that must be decided first (D0)

TicketUG organizer verification and NylonPay payment-provider onboarding **overlap but are
not the same process**, and nothing today keeps them honestly distinct:

| | TicketUG organizer verification (KYC) | NylonPay merchant onboarding |
|---|---|---|
| Question answered | "Who is the entity selling tickets on TicketUG?" | "Whose merchant account receives the money?" |
| Owner of the process | TicketUG (internal data, internal status) | NylonPay (external dashboard, external approval) |
| Applies to | Every organizer (free and paid events) | Only organizers who collect money through the provider |
| Failure mode if conflated | Free/verified organizers blocked by payment-provider rules; or unverified sellers riding a provider approval they never underwent | — |

**Decision D0:** which process is authoritative for what?
- (a) TicketUG KYC is authoritative for *platform participation* (publishing); NylonPay
  approval is authoritative for *money movement* only. **Recommended.**
- (b) NylonPay merchant approval doubles as TicketUG KYC (no internal review; TicketUG
  mirrors a status flag from the provider). Cheapest to operate, but free-event organizers
  get no verification path and the platform depends on an external review it cannot see.

## D1 — What gets verified (scope & tiers)

Options:
- **Tier 1 — Basic identity (individuals):** legal name, phone, mobile-money holder name
  (must match the payout account holder), one government ID document.
- **Tier 2 — Business (registered entities):** Tier 1 for the representative **plus**
  business name, registration number, TIN, and a registration document.
- **Tier 2+ (later, optional):** proof of address / bank letter — recommended to defer.

**Recommendation:** both tiers, chosen by the organizer at submission; Tier 1 suffices for
free events, Tier 1 or 2 for paid events (see D2). Do not build Tier 2+ now.

## D2 — Where verification gates

Options:
- (a) Gates **publishing** of any public event.
- (b) Gates **publishing of paid events only** (free events publish with a Tier 1 identity on file).
- (c) Gates nothing at publish; only gates **payouts** (organizers sell, funds held until verified).
- (d) (a)+(c): publish-gate for paid events, payout-gate always.

**Recommendation:** (b) for launch — lowest friction, no unverified seller collects money,
free community events keep working. Add the payout gate (c) before real money flows; (d)
is the steady state. The publication transition (`lib/server/events.ts` — owner-only
PUBLISHED transition) is the single enforcement point for the publish gate; the payout
gate attaches to the (future) settlement surface and today maps to the NylonPay-dashboard
step.

## D3 — Who reviews, and the read-only constraint

- **Internal review:** a PLATFORM_ADMIN reviews submissions and approves/rejects. ⚠️
  `/platform` is deliberately **read-only end to end** ("investigation and monitoring
  only", app/platform/layout.tsx:46). An approval action would be the area's **first
  mutation** — that is an architecture decision, not a UI tweak. If chosen: keep the
  mutation behind an explicit role (PLATFORM_ADMIN and above), write a `security_event`
  audit row per decision, and never let PLATFORM_SUPPORT approve.
- **Provider-driven:** no internal review; organizer completes NylonPay onboarding, and
  TicketUG stores the resulting status (approved/pending/rejected) as a flag. No new
  mutation surface needed, but D0(b) consequences apply.
- **SLA:** if internal — publish a 2-business-day target; SLA breach shows an honest
  "pending" state, never auto-approval.

**Recommendation:** internal review for Tier 1/2 with the mutation-constraints above,
plus the provider status flag as complementary data (not a substitute).

## D4 — Documents: storage, residency, retention, audit

- **Storage:** Supabase Storage, **private** bucket, per-organizer prefix, signed URLs
  with short expiry; files never reachable through the public site or the Developer API
  (`/openapi.json` surface stays verification-blind).
- **Residency:** decide explicitly (Supabase region is EU-central today); Uganda data
 residency is not available from the current provider — accept or change provider.
- **Retention:** documents deleted N days after (approval + account closure) or
  (rejection + 90 days), whichever the owner sets; deletion must include the storage
  object, not just the row.
- **Audit:** every view/download of a document writes a `security_event`
  (`KYC_DOC_VIEWED`) — the platform area is read-only but document *viewing* must still
  be attributable.

**Decision needed from owner:** retention durations + residency acceptance.

## D5 — Status machine and organizer experience

`NOT_STARTED → PENDING_REVIEW → APPROVED | REJECTED(reason) → RESUBMITTED → PENDING_REVIEW …`

- Organizer-facing status page with the **exact rejection reason** (no shadow bans, no
  silent limbo); re-submission always allowed.
- `PENDING_REVIEW` must not block drafting events or configuring tickets — it gates only
  what D2 says it gates.
- All states server-enforced; UI reads state, never the reverse.

## D6 — What this changes technically (preview only — build after decisions)

- One migration: `ticketug.organizer_verification` (organizer_id, tier, status, reason,
  reviewer, timestamps) + private storage bucket; no changes to the order/issuance paths.
- Publish gate: one predicate added to the existing owner-only transition rule.
- Platform surface: either one approval action (breaking read-only — see D3) or none.
- Developer API: unaffected (verification data never exported).

## Decision checklist (fill and return)

- D0 authoritative split: (a) / (b) → ______
- D1 tiers: Tier1+Tier2 / Tier1 only → ______
- D2 gate: (a)/(b)/(c)/(d) → ______
- D3 reviewer: internal (accept first platform mutation) / provider-flag-only → ______
- D4 retention: approval+__ days; rejection+__ days; residency accepted? → ______
- D5 SLA: __ business days → ______
