import { pool } from './db'

// Pair 5 (§12 user mapping): the TicketUG profile is the permanent relational
// identity; the Supabase Auth user UUID links to it via
// `ticketug.user_profile.auth_user_id` (text, UNIQUE — unchanged schema). The
// Neon-era mapping ran outside the repository (Neon-side provisioning); the
// Supabase migration makes it an explicit, idempotent, server-side step that
// runs as soon as a Supabase session is first established. ON CONFLICT keeps
// repeated sign-ins cheap and never overwrites or duplicates an existing
// profile.
export async function ensureUserProfile(input: { authUserId: string; displayName?: string | null }): Promise<string | null> {
  const authUserId = input.authUserId
  if (!authUserId || authUserId.length > 255) return null
  const displayName = (input.displayName ?? '').toString().slice(0, 200)
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO ticketug.user_profile (id, auth_user_id, display_name)
     VALUES (gen_random_uuid(), $1, $2)
     ON CONFLICT (auth_user_id) DO NOTHING
     RETURNING id`,
    [authUserId, displayName],
  )
  if (inserted.rows[0]) return inserted.rows[0].id
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1',
    [authUserId],
  )
  return existing.rows[0]?.id ?? null
}
