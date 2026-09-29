import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/user-profile'

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(200),
})

// Supabase Auth password sign-in. The session (access + refresh tokens) is
// stored in HttpOnly Secure SameSite=Lax cookies by the server client — the
// browser never sees the tokens. Same 10/min per-IP floor as the previous
// auth proxy applied to sensitive endpoints.
export async function POST(request: Request) {
  const limited = checkRateLimit(rateLimitKey(request, 'auth-sign-in'), 10, 60_000)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 })
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error || !data.user) {
    // Deliberately vague — never reveal whether the account exists.
    return NextResponse.json(
      { error: 'Unable to authenticate with those details. Check your information and try again.' },
      { status: 401 },
    )
  }

  // §12 user mapping: link the Supabase Auth user to its TicketUG profile
  // (idempotent; the profile is the permanent relational identity).
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
  await ensureUserProfile({
    authUserId: data.user.id,
    displayName: typeof metadata.name === 'string' ? metadata.name : null,
  })

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email, name: typeof metadata.name === 'string' ? metadata.name : null },
  })
}
