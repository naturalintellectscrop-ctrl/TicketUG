import { createNeonAuth } from '@neondatabase/auth/next/server'
import { resolveAuthSecret } from '@/lib/auth-secret'

type NeonAuth = ReturnType<typeof createNeonAuth>

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000'

// The auth client is constructed lazily on first use (request time), not at
// module evaluation. Route modules are imported during `next build` page-data
// collection, so evaluating resolveAuthSecret at import time failed every
// production build without BETTER_AUTH_SECRET — taking down the whole
// deployment (including auth-free marketing pages) instead of only auth.
//
// This is NOT a weakening of the fail-closed floor: the identical 32-character
// check runs before the auth client can serve anything, so in a production
// environment without a valid secret every auth-dependent request still fails
// loudly (same error, no fallback secret, sessions cannot be forged). The
// marketing pages that never touch auth simply stay reachable. apps/api keeps
// its boot-time check by design: a service that cannot authenticate should
// crash at startup, and its build never evaluates modules.
let cachedAuth: NeonAuth | null = null

export function getAuth(): NeonAuth {
  if (!cachedAuth) {
    cachedAuth = createNeonAuth({
      baseUrl,
      cookies: { secret: resolveAuthSecret(process.env), sessionDataTtl: 300 },
      logLevel: 'warn',
      ...(process.env.NODE_ENV === 'development'
        ? {
            advanced: {
              defaultCookieAttributes: {
                sameSite: 'none' as const,
                secure: true,
              },
            },
          }
        : {}),
    })
  }
  return cachedAuth
}

export async function getAuthSession() {
  const { data } = await getAuth().getSession()
  return data ?? null
}

export async function requireAuthSession() {
  const session = await getAuthSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export type AuthSession = Awaited<ReturnType<typeof requireAuthSession>>
