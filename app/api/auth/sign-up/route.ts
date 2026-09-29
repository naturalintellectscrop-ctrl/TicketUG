import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/user-profile'

const signUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8).max(200),
})

// Supabase Auth email/password sign-up. `name` is stored in the auth user's
// metadata and seeded into the TicketUG profile on first session. When the
// project enforces email confirmation, the response says so instead of
// establishing a session — the account exists but cannot authenticate until
// the emailed link is used.
export async function POST(request: Request) {
  const limited = checkRateLimit(rateLimitKey(request, 'auth-sign-up'), 10, 60_000)
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)) } },
    )
  }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 })
  const parsed = signUpSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid account details' }, { status: 400 })

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  })
  if (error || !data.user) {
    const message = error?.message ?? ''
    if (/already\s+registered|already\s+exists/i.test(message)) {
      return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Unable to create the account with those details.' }, { status: 400 })
  }

  if (!data.session) {
    // Email confirmation required — no session until the link is used.
    return NextResponse.json({ confirmationRequired: true })
  }

  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>
  await ensureUserProfile({ authUserId: data.user.id, displayName: typeof metadata.name === 'string' ? metadata.name : parsed.data.name })
  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email, name: parsed.data.name },
  })
}
