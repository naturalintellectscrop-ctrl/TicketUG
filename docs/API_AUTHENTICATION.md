# API authentication boundary

TicketUG uses Neon Auth as the sole credential and session authority. The API boundary calls the same server-side Neon Auth session resolver used by Next.js, then maps the validated Neon Auth user ID to `ticketug.user_profile`, active organizer memberships, and platform roles.

The API must never trust `userId`, `role`, `organizerId`, or membership values from request bodies. Controllers receive an `ApiAuthContext` produced by `authenticateApiRequest`; authorization predicates then enforce resource scope.

## NestJS integration

The repository does not currently contain a NestJS service. `lib/api-auth.ts` is the framework-neutral contract for a future Nest guard. The future guard should call `authenticateApiRequest`, attach the context to the request, and use `requireApiRole` or domain predicates in the service layer. It must not create a second login, password, token, or session system.

Unauthenticated requests fail closed with `UNAUTHENTICATED`; authenticated users without the requested role fail with `FORBIDDEN`.
