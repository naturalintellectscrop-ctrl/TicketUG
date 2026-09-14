import { Pool } from 'pg'

const globalForDb = globalThis as unknown as { ticketugPool?: Pool }

export const pool =
  globalForDb.ticketugPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  })

if (process.env.NODE_ENV !== 'production') globalForDb.ticketugPool = pool

export async function withTransaction<T>(callback: (client: import('pg').PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
