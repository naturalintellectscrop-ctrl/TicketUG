# ADR 0001: Foundation

## Status

Accepted for Phase 1.

## Decision

Use Next.js 16 App Router for the initial public web surface and Neon PostgreSQL as the connected persistence foundation. Keep the first iteration as a small, explicit application boundary while preserving package boundaries for future organizer, admin, and scanner surfaces.

## Consequences

This keeps the initial deployment simple and makes the database available without introducing premature microservices. Authentication and domain schema will be added in their own reviewed increments.
