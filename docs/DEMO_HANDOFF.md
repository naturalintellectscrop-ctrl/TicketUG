# TicketUG Development Demo

## Purpose

This is a development-only product walkthrough. Payment is simulated with the `test` adapter and no money moves. Live payment-provider support is not configured.

## Start-up requirements

Use the project development environment with:

- `NODE_ENV=development`
- `PAYMENT_MODE=test`
- optional `PAYMENT_TEST_WEBHOOK_SECRET` configured in the development environment; when omitted, the non-production test adapter uses its clearly development-only fallback secret
- the normal development `DATABASE_URL`

Do not use production credentials or production data. The application does not require `TEST_DATABASE_URL` for normal development or this interactive walkthrough.

## Walkthrough

1. Create or sign in as an organizer.
2. Open the organizer workspace and create an event.
3. Add ticket types and publish the event.
4. Open the public event page as an unauthenticated visitor.
5. Use guest checkout or sign in as an attendee.
6. Create an order and select **Complete simulated payment**.
7. Confirm the signed test webhook makes the order paid and issues tickets.
8. Open the issued ticket and display its QR code.
9. Sign in as event staff and open `/scanner`.
10. Select the assigned event and scan the attendee QR, or use manual entry.
11. Scan the same ticket again to verify duplicate rejection.
12. Sign in with an approved platform role and open `/admin` to review real platform metrics.

## Safety boundary

The test payment action is only enabled outside production when `PAYMENT_MODE=test`. It uses the existing provider webhook verification and payment-to-ticket issuance transaction; it is not a client-authoritative “mark paid” endpoint.

## Known limitations

- No live provider has been approved.
- Refunds, settlements, ledger accounting, and reconciliation are not implemented.
- PostgreSQL concurrency remains environment-unverified.
- Physical camera decoding depends on the current browser/device; manual QR entry remains available.
- Development credentials must be created through the configured Neon Auth flow; no production credentials are committed here.
