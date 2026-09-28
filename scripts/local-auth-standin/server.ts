// LOCAL Better Auth stand-in for the managed Neon Auth service (staging only).
// Neon Auth is Better Auth managed by Neon; @neondatabase/auth's proxy hits
// `${NEON_AUTH_BASE_URL}/sign-in/email` etc. with NO /api/auth prefix, so this
// engine serves Better Auth at the base URL root (basePath '/').
// Same wire contract: same secret, same __Secure-neon-auth.* cookie names.
import { betterAuth } from 'better-auth'
import { toNodeHandler } from 'better-auth/node'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import http from 'node:http'

const PORT = 5999
const SECRET = process.env.BETTER_AUTH_SECRET!
if (!SECRET || SECRET.length < 32) throw new Error('BETTER_AUTH_SECRET must be >= 32 chars')

const db = new Kysely({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: process.env.AUTH_DATABASE_URL ?? 'postgresql://ticketug:ticketug@localhost:5433/neon_auth_standin' }) }) })

export const auth = betterAuth({
  baseURL: `http://localhost:${PORT}`,
  basePath: '/',
  secret: SECRET,
  database: { db, type: 'postgres' as const },
  emailAndPassword: { enabled: true },
  rateLimit: { enabled: false },
  trustedOrigins: ['http://localhost:3100', 'http://127.0.0.1:3100', 'http://localhost:3000', 'http://127.0.0.1:3000'],
  advanced: { cookiePrefix: '__Secure-neon-auth', defaultCookieAttributes: { sameSite: 'lax', secure: true } },
})

// auto-create the four core tables (same path better-auth's CLI/migrations use)
const { getMigrations } = await import('better-auth/db/migration')
const { runMigrations } = await getMigrations({ ...(auth.options as object), database: { db, type: 'postgres' } } as never)
await runMigrations()
console.log('[auth-standin] migrations applied')

const server = http.createServer((req, res) => { (toNodeHandler(auth) as (req: unknown, res: unknown) => void)(req, res) })
server.listen(PORT, '0.0.0.0', () => console.log(`[auth-standin] Better Auth engine on :${PORT}`))
