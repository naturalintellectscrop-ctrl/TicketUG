import { describe, expect, it } from 'vitest'
import { Pool } from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('TicketUG database integration boundary', () => {
  const pool = new Pool({ connectionString: databaseUrl })
  it('keeps TicketUG tables isolated from the auth schema', async () => {
    const result = await pool.query<{ table_schema: string; table_name: string }>(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('ticketug', 'auth', 'neon_auth') ORDER BY table_schema, table_name`)
    expect(result.rows.some((row) => row.table_schema === 'ticketug' && row.table_name === 'user_profile')).toBe(true)
    // Supabase (Pair 5): the managed GoTrue schema is `auth`; the legacy Neon Auth
    // `neon_auth` schema must not exist anywhere in the migrated project.
    expect(result.rows.some((row) => row.table_schema === 'auth')).toBe(true)
    expect(result.rows.some((row) => row.table_schema === 'neon_auth')).toBe(false)
    await pool.end()
  })
})
