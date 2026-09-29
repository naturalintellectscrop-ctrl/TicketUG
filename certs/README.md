# TLS certificates

## `supabase-root-2021-ca.pem` — Supabase Root 2021 CA (PUBLIC certificate, not a secret)

Supabase Postgres endpoints (session pooler `*.pooler.supabase.com`, direct
`db.<ref>.supabase.co`) terminate TLS with certificates signed by Supabase's
own CA — **not** a public CA in the Node.js default trust store. TicketUG keeps
strict TLS verification (`rejectUnauthorized: true` everywhere, never
disabled) and pins this CA instead:

- Web pool: `lib/db.ts`
- NestJS API pool: `apps/api/src/common/database.service.ts`
- Migration runner: `scripts/migrate.mjs`
- Override path: `SUPABASE_CA_CERT` environment variable (must point at a PEM
  file; set-but-unreadable fails loudly rather than silently downgrading)

Provenance & verification (NI operators):

1. The bundled PEM was extracted from the live TLS chain served by
   `aws-1-eu-central-1.pooler.supabase.com` (self-signed root, subject ==
   issuer).
2. SHA-256 fingerprint:
   `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
3. Verify against Supabase's official publication before production cutover:
   `openssl x509 -in certs/supabase-root-2021-ca.pem -noout -fingerprint -sha256`
   If Supabase ever rotates this CA (check their SSL/TLS documentation), place
   the new PEM at `SUPABASE_CA_CERT` — no code change needed.
