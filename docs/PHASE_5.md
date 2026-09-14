# TicketUG Phase 5

## Scope
Phase 5 establishes the event-management domain: events, reusable organizer venues, event media metadata, constrained lifecycle transitions, organizer APIs, and public event representation. Ticket purchase, inventory, checkout, payments, tickets, scanning, refunds, settlements, analytics, and admin workflows are intentionally not implemented.

## Decisions
- RETAIN: Phase 1–4 Neon Auth, TicketUG identity, authorization, PostgreSQL access, and NestJS bootstrap.
- BUILD: `ticketug.event`, `ticketug.venue`, and `ticketug.event_media` schema boundaries, event lifecycle rules, API contracts, organizer pages, and public event pages.
- COMPLETE: Organizer event access is checked against server-derived active memberships; public responses omit internal organizer/user fields.
- DEFER: Storage-provider upload orchestration and database-backed certification remain future infrastructure work.

## Schema migration
The reviewed forward-only SQL is at `docs/migrations/005-events.sql`. It must be applied through the repository's controlled migration process to the intended TicketUG database after review. It does not touch `neon_auth` and was not applied automatically during this phase.

## API
- `GET /api/v1/organizers/:organizerId/events`
- `POST /api/v1/organizers/:organizerId/events`
- `GET /api/v1/events/:eventId`
- `PATCH /api/v1/events/:eventId`
- `POST /api/v1/events/:eventId/transition`
- `POST /api/v1/events/:eventId/media`
- `DELETE /api/v1/events/:eventId/media/:mediaId`
- `POST /api/v1/organizers/:organizerId/venues`
- `GET /api/v1/public/events/:slug`

## Certification note
Phase 4.1 DB-backed security certification remains UNVERIFIED because an isolated test database could not be provisioned. No production database was used for destructive testing.

## Known limitations
The migration is supplied as a reviewed forward-only SQL migration and was not applied automatically to production. Media URLs are validated metadata contracts; provider upload/signing is deferred. Next.js compatibility routes use the existing TicketUG database directly until the web-to-NestJS migration is completed. The local preview may return 404 for public events until the migration has been applied and a public event exists.

## Phase 6 dependencies
Ticket types and inventory can reference `ticketug.event.id` after this schema is applied. No ticketing or payment behavior is part of Phase 5.
