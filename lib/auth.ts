import { getSupabaseServerClient } from './supabase/server'

// Pair 5: Supabase Auth session resolution (replaces the Neon Auth adapter).
// The auth client is constructed lazily on first use (request time), not at
// module evaluation — same build-safety contract as before: route modules are
// imported during `next build` page-data collection, so evaluating auth
// configuration at import time would fail every production build without
// configuration. The fail-closed floor is unchanged: without valid Supabase
// configuration every auth-dependent request fails loudly in production and
// sessions cannot be forged; auth-free marketing pages stay reachable.
export interface AuthUser {
  id: string
  email?: string | null
  name?: string | null
}

export interface AuthSession {
  user: AuthUser
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  // getUser() validates the session with the Supabase Auth service (and
  // refreshes it server-side when the access token has expired) — never trust
  // the raw cookie contents without validation.
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      name: typeof metadata.name === 'string' && metadata.name.length > 0 ? metadata.name : null,
    },
  }
}

export async function requireAuthSession(): Promise<AuthSession> {
  const session = await getAuthSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}
