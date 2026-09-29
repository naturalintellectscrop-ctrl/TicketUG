import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { resolveSupabaseConfig } from '../supabase-config'

type SupabaseServerClient = ReturnType<typeof createServerClient>

// The client is constructed per request (its cookie adapter binds to the
// current request's cookie store, which must never be cached across requests)
// and only on first use — never at module evaluation. Route modules are
// imported during `next build` page-data collection, so auth construction at
// import time would fail every production build without configuration. This is
// NOT a weakening of the fail-closed floor: the identical configuration check
// runs before the client can serve anything, so in production without valid
// configuration every auth-dependent request still fails loudly. The marketing
// pages that never touch auth simply stay reachable.
//
// Cookie contract (all cookie writes happen server-side):
//   sb-<project-ref>-auth-token[.N]  — HttpOnly, Secure, SameSite=Lax,
//   value 'base64-' + base64url(JSON session) (chunked every 3180 chars).
// The NestJS API parses this exact format (apps/api/src/auth/supabase-auth.ts).
export async function getSupabaseServerClient(): Promise<SupabaseServerClient | null> {
  // Await the request's cookie store FIRST: during `next build` static
  // generation this throws Next's dynamic-usage error, which marks the route
  // dynamic and ends evaluation — so builds never evaluate auth configuration
  // (the documented Pair-2/3 contract: identical fail-closed floor, enforced
  // at the request boundary; builds simply do not reach it).
  const cookieStore = await cookies()
  const config = resolveSupabaseConfig(process.env)
  if (!config) return null
  return createServerClient(config.url, config.anonKey, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Next.js Server Components cannot write cookies. The refreshed
          // session still serves the current render; route handlers (proxies,
          // /api/auth/*) persist new cookies on their responses.
        }
      },
    },
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    },
  })
}
