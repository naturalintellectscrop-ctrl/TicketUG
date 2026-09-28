# Local Neon Auth stand-in (staging verification only)

Pair 3 needed REAL authenticated browser journeys without Neon credentials.
Neon Auth is Better Auth managed by Neon; `@neondatabase/auth`'s proxy hits
`${NEON_AUTH_BASE_URL}/sign-in/email`, `/get-session`, … with **no** `/api/auth`
prefix, and mints `__Secure-neon-auth.session_token` /
`__Secure-neon-auth.local.session_data` cookies signed with BETTER_AUTH_SECRET.

This folder documents (not replaces) how to run the actual Better Auth engine
(the exact version `@neondatabase/auth@0.5.0-beta` depends on: **1.6.23**)
locally so both tiers' real guards can be exercised end-to-end:

```bash
# 1. Throwaway project (NOT the TicketUG workspace — keeps deps isolated)
mkdir /tmp/ticketug-auth-standin && cd /tmp/ticketug-auth-standin
echo '{"name":"t","private":true,"type":"module","dependencies":{"better-auth":"1.6.23","kysely":"0.29.5","pg":"8.23.0"}}' > package.json
bun install
# 2. Copy server.ts from this folder, then boot against a throwaway Postgres DB
#    (the server auto-runs better-auth's own migrations → user/session/account/verification)
BETTER_AUTH_SECRET="<same 32+ char secret both tiers use>" bun server.ts   # listens on :5999
# 3. Point NEON_AUTH_BASE_URL at http://localhost:5999 for BOTH the Next app
#    and apps/api. Sign-up/sign-in through the REAL /sign-in UI.
# 4. Staging prerequisite: auth users get a ticketug.user_profile row keyed by
#    auth_user_id (mirrors production provisioning; no in-app flow exists).
```

`server.ts` is committed for reference; run it from the throwaway project above.
NEVER point a production deployment at this stand-in.
