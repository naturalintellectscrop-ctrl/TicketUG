import { describe, expect, it } from 'vitest'
import { Pool } from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('TicketUG database integration boundary', () => {
  const pool = new Pool({ connectionString: databaseUrl })
  it('keeps TicketUG tables isolated from Neon Auth', async () => {
    const result = await pool.query<{ table_schema: string; table_name: string }>(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('ticketug', 'neon_auth') ORDER BY table_schema, table_name`)
    expect(result.rows.some((row) => row.table_schema === 'ticketug' && row.table_name === 'user_profile')).toBe(true)
    expect(result.rows.some((row) => row.table_schema === 'neon_auth')).toBe(true)
    await pool.end()
  })
})
