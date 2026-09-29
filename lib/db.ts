import { readFileSync } from 'node:fs'
import { Pool } from 'pg'

const globalForDb = globalThis as unknown as { ticketugPool?: Pool }

// Pair 5 (Supabase): Supabase terminates TLS with its own CA ("Supabase Root
// 2021 CA"), which is not in the Node default trust store. Strict verification
// is PRESERVED — the CA is pinned instead of weakening rejectUnauthorized.
// Order: SUPABASE_CA_CERT env override (fail loudly when set but unreadable),
// then the bundled certs/supabase-root-2021-ca.pem. The same posture is used
// by apps/api (DatabaseService) and scripts/migrate.mjs.
function loadSupabaseCa(connectionString: string): string | undefined {
  let host = ''
  try {
    host = new URL(connectionString).hostname
  } catch {
    return undefined
  }
  const isSupabaseHost = host.endsWith('.supabase.co') || host.endsWith('.supabase.com')
  const envPath = process.env.SUPABASE_CA_CERT
  if (envPath) {
    // An explicitly configured CA is a deployment contract — fail loudly
    // rather than silently dropping to weaker verification.
    return readFileSync(envPath, 'utf8')
  }
  if (!isSupabaseHost) return undefined
  try {
    return readFileSync('certs/supabase-root-2021-ca.pem', 'utf8')
  } catch {
    return undefined
  }
}

// When no DATABASE_URL is configured (local dev without a database, sandbox smoke),
// a real pg Pool fails deep inside its async connection internals with an
// UNCAUGHT aggregate error, crashing the process before any try/catch can run.
// A stub whose queries reject with a clear error keeps every surface honest:
// pages render their designed error states instead of 500ing.
const UNCONFIGURED_MESSAGE = 'DATABASE_URL is not configured — TicketUG is running without a database'

function unconfiguredPool(): Pool {
  const reject = () => Promise.reject(new Error(UNCONFIGURED_MESSAGE))
  return {
    query: reject,
    connect: reject,
    on: () => undefined,
  } as unknown as Pool
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return unconfiguredPool()
  const ca = loadSupabaseCa(connectionString)
  // TLS: strict verification everywhere it applies — rejectUnauthorized is
  // never disabled; the Supabase CA is supplied for Supabase endpoints.
  const ssl = ca
    ? { rejectUnauthorized: true, ca }
    : process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : undefined
  const pool = new Pool({
    connectionString,
    ssl,
    max: 5,
    // Bound how long a request can hang on an unreachable database; the
    // timeout path rejects queries cleanly so pages can render error states.
    connectionTimeoutMillis: 10_000,
  })
  // Idle-client connection failures surface through query rejections; without
  // this handler they would crash the process as uncaughtException.
  pool.on('error', () => {})
  return pool
}

export const pool = globalForDb.ticketugPool ?? createPool()

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
