import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// Supabase Auth sign-out. The server client revokes the session's refresh
// token with the Auth service and clears the HttpOnly session cookies from
// this origin. The access token itself is a short-lived JWT (≤1 h by
// default); browser-side it dies with the cleared cookies. Fail-safe: the
// response succeeds even when the Auth service is unreachable (cookies are
// still cleared client-side).
export async function POST() {
  const supabase = await getSupabaseServerClient()
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch {
      // Network/service failure — fall through; the response clears nothing
      // more, but the client also drops all state and redirects to sign-in.
    }
  }
  return new NextResponse(null, { status: 204 })
}
