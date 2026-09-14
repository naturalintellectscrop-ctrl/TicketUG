# TicketUG Phase 10.1

## Status
Camera QR scanning is integrated into the existing Phase 10 scanner. The browser decodes camera frames only; the existing authenticated `/api/check-ins` proxy and server-side validation/check-in transaction remain authoritative.

## Decisions
- Phase 10 validation, event authorization, check-in transaction, API contract, manual entry, and QR format were retained.
- `qr-scanner` 1.4.2 was added as the single browser QR decoder.
- TicketUG payloads remain `ticketug:v1:<credential>` and are format-checked before submission.
- Duplicate frames are suppressed while verification is active and during a short same-credential cooldown. This is UX protection; server-side replay protection remains authoritative.
- Camera streams and decoder instances are stopped on result, event change, explicit stop, and unmount.
- Offline acceptance is intentionally not implemented.

## Camera behavior
The scanner requests the environment-facing camera, renders a live video preview with a scan guide, and handles unsupported browsers, unavailable devices, denied permissions, startup errors, and manual fallback. A `Scan next` action clears the previous result and starts a fresh camera session.

## Verification
- Typecheck: passed.
- ESLint: passed.
- Production build: passed.
- Browser route verification: passed; `/scanner` renders safely when no assigned events exist.
- Physical camera hardware decoding: unverified in the sandbox.
- Database-backed ticket validation and concurrency: remain unverified because no dedicated test database is configured.

## Scope boundary
No new backend endpoint, validation service, offline mode, payment behavior, database migration, or Phase 11 functionality was added.
