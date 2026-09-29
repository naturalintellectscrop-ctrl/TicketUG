import { getSupabaseServerClient } from './supabase/server'

// Forwarding headers for the thin Next→Nest proxies.
//
// Pair 5: the Neon Auth session cookie (a 7-day session_token the API alone
// could resolve) is gone. Supabase access tokens are short-lived ES256 JWTs
// (default 1 h), so the proxy layer is responsible for handing the API a
// FRESH credential:
//   1. reuse the cookie session while its access token is still fresh;
//   2. otherwise refresh via getUser() (route handlers persist the new
//      cookies) and use the refreshed token;
//   3. always forward the original Cookie header — the Nest guard keeps a
//      cookie path as a fallback for direct browser calls.
// The API re-verifies the JWT signature against the project's JWKS either way;
// no token is cached beyond the request and failures stay fail-closed.
export async function authenticatedForwardHeaders(request: Request): Promise<Record<string, string>> {
  const headers: Record<string, string> = { cookie: request.headers.get('cookie') ?? '' }
  try {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return headers
    const { data } = await supabase.auth.getSession()
    let accessToken = data.session?.access_token
    const expiresAtMs = (data.session?.expires_at ?? 0) * 1000
    if (!accessToken || expiresAtMs - 30_000 <= Date.now()) {
      // Expired (or expiring within the skew buffer): getUser() performs the
      // refresh against Supabase Auth; the refreshed cookies are persisted by
      // the server client (route-handler context).
      await supabase.auth.getUser()
      accessToken = (await supabase.auth.getSession()).data.session?.access_token ?? accessToken
    }
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
  } catch {
    // Auth unavailable — forward cookies only; the Nest guard rejects
    // unauthenticated requests exactly as it always has.
  }
  return headers
}
