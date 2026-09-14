import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Pool, PoolClient } from 'pg'

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  async query<T extends object = Record<string, unknown>>(text: string, values: unknown[] = []) { return this.pool.query<T>(text, values) }
  async transaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect()
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result }
    catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
  }
  async onModuleDestroy() { await this.pool.end() }
}
