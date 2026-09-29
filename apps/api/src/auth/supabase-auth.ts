import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey, type JWTVerifyOptions } from 'jose'
import type { IncomingHttpHeaders } from 'node:http'

// Pair 5: Supabase Auth verification for the NestJS API boundary.
//
// Wire model (replaces the Neon Auth / Better Auth session resolver):
//   - Supabase Auth mints short-lived ES256 (asymmetric) access tokens whose
//     public keys are published at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
//   - The API verifies tokens LOCALLY against that JWKS — no shared secret,
//     no service-role key, and no per-request network hop (jose caches keys).
//   - The verified `sub` claim (the Supabase Auth user UUID) maps to
//     `ticketug.user_profile.auth_user_id` exactly as before — TicketUG's
//     authorization model is unchanged.
// Fail-closed posture (mirrors the previous boot-time secret floor): without a
// valid SUPABASE_URL the API refuses to start in production; every unresolvable
// token, expired token, forged signature, wrong issuer or wrong audience is
// rejected with 401.

export interface AccessTokenClaims {
  /** Supabase Auth user UUID (`sub`). */
  sub: string
  email?: string
}

/** Storage key derived exactly like supabase-js (`sb-<host-first-label>-auth-token`). */
export function supabaseStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname
  return `sb-${host.split('.')[0]}-auth-token`
}

const ACCEPTED_ALGORITHMS = ['ES256', 'RS256', 'PS256', 'EdDSA']

/** Claim-level validation on top of signature/expire verification. */
function claimsFromPayload(payload: JWTPayload, expectedIssuer: string): AccessTokenClaims | null {
  if (!payload.sub) return null
  // Cross-project/cross-service token replay is rejected by binding the token
  // to this project's Auth issuer and to authenticated (non-anonymous) users.
  const issuer = typeof payload.iss === 'string' ? payload.iss.replace(/\/+$/, '') : null
  if (!issuer || issuer !== expectedIssuer.replace(/\/+$/, '')) return null
  if (payload.aud !== 'authenticated') return null
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined }
}

/** Pure verification entry point (also used by tests with a local JWKS). */
export async function verifyAccessTokenWithKeyStore(
  keyStore: JWTVerifyGetKey,
  token: string,
  expectedIssuer: string,
): Promise<AccessTokenClaims | null> {
  const options: JWTVerifyOptions = { algorithms: ACCEPTED_ALGORITHMS, clockTolerance: 5 }
  try {
    const { payload } = await jwtVerify(token, keyStore, options)
    return claimsFromPayload(payload, expectedIssuer)
  } catch {
    return null
  }
}

export type SupabaseTokenVerifier = (token: string) => Promise<AccessTokenClaims | null>

/** Remote-JWKS verifier used in production (keys cached/cooldown by jose). */
export function createSupabaseTokenVerifier(supabaseUrl: string): SupabaseTokenVerifier {
  const jwks = createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`), {
    cooldownDuration: 60_000,
    cacheMaxAge: 600_000,
  })
  const expectedIssuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`
  return (token) => verifyAccessTokenWithKeyStore(jwks, token, expectedIssuer)
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const name = part.slice(0, index).trim()
    if (!name) continue
    if (!cookies.has(name)) cookies.set(name, part.slice(index + 1).trim())
  }
  return cookies
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract the Supabase access token from the forwarded session cookie.
 *
 * Format contract of `@supabase/ssr` (cookieEncoding 'base64url'):
 *   value          = 'base64-' + base64url(JSON.stringify(session))
 *   cookie name    = `${storageKey}` (single) or `${storageKey}.0`, `.1`, …
 *                    (chunks of the encoded value, 3180 encoded chars each;
 *                    base64url characters are encodeURIComponent-stable, so
 *                    reassembly is plain concatenation in index order).
 */
export function extractSupabaseAccessTokenFromCookie(cookieHeader: string, storageKey: string): string | null {
  if (!cookieHeader) return null
  const cookies = parseCookieHeader(cookieHeader)
  const direct = cookies.get(storageKey)
  let rawValue: string | null = direct ?? null
  if (rawValue === null) {
    const chunkPattern = new RegExp(`^${escapeRegExp(storageKey)}\\.(0|[1-9][0-9]*)$`)
    const chunks = [...cookies.entries()]
      .filter(([name]) => chunkPattern.test(name))
      .sort((a, b) => Number(a[0].split('.').pop()) - Number(b[0].split('.').pop()))
    if (chunks.length === 0) return null
    rawValue = chunks.map(([, value]) => value).join('')
  }
  const encoded = rawValue.startsWith('base64-') ? rawValue.slice('base64-'.length) : rawValue
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8')
    const session = JSON.parse(decoded) as { access_token?: unknown }
    return typeof session.access_token === 'string' && session.access_token.length > 0 ? session.access_token : null
  } catch {
    return null
  }
}

/**
 * Resolve the request's access token:
 *   1. `Authorization: Bearer <token>` (fresh token forwarded by the Next
 *      proxy layer — refresh-aware), then
 *   2. the Supabase session cookie (direct browser→API calls).
 */
export function extractRequestAccessToken(headers: IncomingHttpHeaders, storageKey: string): string | null {
  const authorization = headers['authorization']
  if (typeof authorization === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
    if (match?.[1]) return match[1].trim()
  }
  const cookieHeader = headers['cookie']
  if (typeof cookieHeader === 'string') return extractSupabaseAccessTokenFromCookie(cookieHeader, storageKey)
  return null
}
