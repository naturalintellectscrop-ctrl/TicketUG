import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { readFileSync } from 'node:fs'
import { Pool, PoolClient, type PoolConfig } from 'pg'

// Pair 5 (Supabase): pin the Supabase Root CA when connecting to Supabase
// endpoints — the same posture the web pool (lib/db.ts) uses. TLS verification
// is never weakened: rejectUnauthorized stays true and the CA is supplied.
// Non-Supabase hosts keep the previous behavior (SSL controlled by the
// connection string's sslmode, e.g. verify-full in staging).
function tryReadCa(): string | undefined {
  const envPath = process.env.SUPABASE_CA_CERT
  if (envPath) {
    // An explicitly configured CA is a deployment contract — fail loudly
    // rather than silently dropping to weaker verification.
    return readFileSync(envPath, 'utf8')
  }
  try {
    return readFileSync('certs/supabase-root-2021-ca.pem', 'utf8')
  } catch {
    return undefined
  }
}

function buildPoolConfig(connectionString: string | undefined): PoolConfig {
  if (!connectionString) return { max: 10 }
  let host = ''
  try {
    host = new URL(connectionString).hostname
  } catch {
    return { connectionString, max: 10 }
  }
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) {
    const ca = tryReadCa()
    return ca ? { connectionString, max: 10, ssl: { rejectUnauthorized: true, ca } } : { connectionString, max: 10, ssl: { rejectUnauthorized: true } }
  }
  return { connectionString, max: 10 }
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool: Pool

  constructor() {
    this.pool = new Pool(buildPoolConfig(process.env.DATABASE_URL))
  }

  async query<T extends object = Record<string, unknown>>(text: string, values: unknown[] = []) { return this.pool.query<T>(text, values) }
  async transaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect()
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result }
    catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  async onModuleDestroy() { await this.pool.end() }
}
