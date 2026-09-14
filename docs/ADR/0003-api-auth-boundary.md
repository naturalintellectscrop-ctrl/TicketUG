# ADR 0003: API authentication boundary

## Status

Accepted for Phase 3.

## Decision

The future NestJS API will trust only a server-side session resolved through the existing Neon Auth integration. It will map the Neon Auth user ID to `ticketug.user_profile`, then resolve active memberships and platform roles. Request bodies cannot override identity, organization, role, or membership context.

## Consequences

Next.js route handlers and NestJS controllers share the same TicketUG context and authorization semantics. The repository currently has no NestJS service, so `lib/api-auth.ts` is the integration contract and the Nest guard remains a Phase 4 implementation concern. No duplicate passwords, tokens, session tables, or login flow are introduced.
