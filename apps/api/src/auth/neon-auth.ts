import { AsyncLocalStorage } from 'node:async_hooks'
import type { CookieOptions, RequestContext } from '@neondatabase/auth/server'
import { createAuthServer } from '@neondatabase/auth/server'

// Fail closed in production (mirrors lib/auth.ts on the Next side): a shipped
// fallback secret would let anyone forge session cookies for the API.
function sessionSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET must be set to at least 32 characters in production')
  return 'development-only-secret-change-me-32-chars'
}

// Per-request state surfaced to the Neon Auth SDK through AsyncLocalStorage —
// the exact pattern the SDK documents for framework adapters ("Adapters
// typically capture per-request state via AsyncLocalStorage"; the bundled
// Next.js adapter does the same via next/headers). The SDK calls the context
// factory with no arguments on every server method invocation, so ambient
// request state is the only way to feed it the current request's cookies.
export interface NeonAuthRequestScope {
  /** Raw `Cookie:` header of the incoming request. */
  cookieHeader: string
  /** Absolute origin of the incoming request ('' when unknowable). */
  origin: string
  /** Case-insensitive single request-header lookup (null when absent). */
  getHeader: (name: string) => string | null
  /** Serialized Set-Cookie values minted by the SDK for this response. */
  responseCookies: string[]
}

export const neonAuthScope = new AsyncLocalStorage<NeonAuthRequestScope>()

// Serialize a Set-Cookie value from the SDK's pre-sanitized CookieOptions.
// (Express's res.cookie() expects maxAge in milliseconds while the SDK emits
// seconds, so the API tier serializes explicitly instead of re-mapping.)
function serializeSetCookie(name: string, value: string, options: CookieOptions): string {
  let header = `${name}=${value}`
  if (options.maxAge !== undefined) header += `; Max-Age=${Math.floor(options.maxAge)}`
  if (options.expires) header += `; Expires=${options.expires.toUTCString()}`
  header += `; Path=${options.path ?? '/'}`
  if (options.domain) header += `; Domain=${options.domain}`
  if (options.secure) header += '; Secure'
  if (options.httpOnly) header += '; HttpOnly'
  if (options.sameSite) header += `; SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`
  return header
}

function createNestRequestContext(): RequestContext {
  const scope = neonAuthScope.getStore()
  return {
    // Unfiltered cookie header — the SDK accepts it verbatim (parseCookieValue
    // picks the cookies it needs; upstream receives the full browser context).
    getCookies: () => scope?.cookieHeader ?? '',
    setCookie: (name, value, options) => {
      scope?.responseCookies.push(serializeSetCookie(name, value, options))
    },
    getHeader: (name) => scope?.getHeader(name) ?? null,
    getOrigin: () => scope?.origin ?? '',
    getFramework: () => 'nestjs',
  }
}

// createAuthServer from '@neondatabase/auth/server' is the framework-agnostic
// factory the package's own Next.js wrapper (createNeonAuth in
// @neondatabase/auth/next/server) builds on. The Next-specific entrypoint
// cannot run here: it imports next/headers + next/server, which are outside
// this package's dependency graph under pnpm's strict isolation, and their
// request-scoped APIs throw outside a Next request context anyway.
export const neonAuth = createAuthServer({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000',
  context: createNestRequestContext,
  cookieSecret: sessionSecret(),
  sessionDataTtl: 300,
})
