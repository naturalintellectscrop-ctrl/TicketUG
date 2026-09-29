// Pair 5: Supabase Auth configuration (replaces lib/auth-secret.ts).
//
// Fail closed in production — the same contract the Better Auth secret floor
// enforced: a deployment without valid auth configuration must never fall back
// to a fake or anonymous identity. Every auth-dependent request errors loudly
// instead. `next build` does not evaluate this module at import time (callers
// construct clients lazily on first request), so builds succeed without
// configuration and auth simply stays dead until the variables are set.
//
// SUPABASE_ANON_KEY is the project's publishable key: it is safe by design,
// but this application keeps it server-side (all Supabase traffic flows
// through Next.js server code) so no auth surface is exposed to browser
// bundles at all.

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function resolveSupabaseConfig(env: {
  SUPABASE_URL?: string | undefined
  SUPABASE_ANON_KEY?: string | undefined
  NODE_ENV?: string | undefined
}): SupabaseConfig | null {
  const url = env.SUPABASE_URL?.trim() ?? ''
  const anonKey = env.SUPABASE_ANON_KEY?.trim() ?? ''
  if (url && anonKey && /^https?:\/\//i.test(url)) return { url, anonKey }
  if (env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in production')
  }
  return null
}
