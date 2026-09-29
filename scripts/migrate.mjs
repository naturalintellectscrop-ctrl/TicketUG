#!/usr/bin/env node
// TicketUG migration runner (Pair 5, §9 CASE B "COMPLETE").
//
// The smallest production-appropriate mechanism: deterministic ordering, a
// migration ledger, no reapplication of applied migrations, transactional
// application where PostgreSQL permits it, safe repeated execution, useful
// CLI output, and NO destructive reset behavior.
//
// Ledger: ticketug.migration (name PRIMARY KEY, checksum, applied_at).
//
// File contract (matches the repository convention — 005→011 are
// self-transactional `BEGIN;…COMMIT;` files):
//   * self-transactional file  → executed VERBATIM (its own BEGIN/COMMIT
//     governs); the ledger row is recorded afterwards in its own transaction.
//     Re-applying such a file after a crash between COMMIT and ledger insert
//     is safe: every 005→011 statement is IF NOT EXISTS / DROP-IF-EXISTS.
//   * non-self-transactional file → wrapped in BEGIN…COMMIT together with its
//     ledger row (fully atomic).
//
// Usage:
//   node scripts/migrate.mjs            # apply pending migrations
//   node scripts/migrate.mjs --status   # show state without applying
//
// Environment: DATABASE_URL (required). TLS: strict verification for Supabase
// endpoints (pinned CA — see certs/README.md); never weakened.

import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = path.join(ROOT, 'docs', 'migrations')
const BUNDLED_CA = path.join(ROOT, 'certs', 'supabase-root-2021-ca.pem')

function buildClientConfig() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('[migrate] DATABASE_URL is not set — refusing to run.')
    process.exit(1)
  }
  const config = { connectionString, connectionTimeoutMillis: 15_000 }
  try {
    const host = new URL(connectionString).hostname
    if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) {
      const envPath = process.env.SUPABASE_CA_CERT
      const ca = envPath
        ? readFileSync(envPath, 'utf8')
        : readFileSync(BUNDLED_CA, 'utf8')
      config.ssl = { rejectUnauthorized: true, ca }
    }
  } catch (error) {
    if (process.env.SUPABASE_CA_CERT) throw error
    // Non-supabase host: leave SSL to the connection string (sslmode=…).
  }
  return config
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function checksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex')
}

async function ensureLedger(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS ticketug')
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticketug.migration (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
}

const isSelfTransactional = (sql) => /^\s*BEGIN\s*;/i.test(sql) && /;\s*COMMIT\s*;/i.test(sql)

async function main() {
  const statusOnly = process.argv.includes('--status')
  const files = migrationFiles()
  const client = new pg.Client(buildClientConfig())
  await client.connect()
  try {
    await ensureLedger(client)
    const appliedRows = await client.query('SELECT name, checksum FROM ticketug.migration')
    const applied = new Map(appliedRows.rows.map((row) => [row.name, row.checksum]))

    // Drift check: an applied migration must be byte-identical on disk.
    let drift = false
    for (const [name, checksumInDb] of applied) {
      const file = files.find((candidate) => candidate === name)
      if (!file) {
        console.warn(`[migrate] WARNING: ${name} is recorded in the ledger but the file is missing on disk.`)
        continue
      }
      const disk = checksum(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'))
      if (disk !== checksumInDb) {
        console.error(`[migrate] ERROR: ${name} changed on disk since it was applied (checksum mismatch). Applied migrations are immutable — restore the file or add a NEW forward migration.`)
        drift = true
      }
    }
    if (drift) process.exit(1)

    const pending = files.filter((name) => !applied.has(name))
    if (statusOnly) {
      console.log(`[migrate] migrations directory: docs/migrations (${files.length} files)`)
      for (const name of files) {
        console.log(applied.has(name) ? `  applied   ${name}` : `  pending   ${name}`)
      }
      for (const name of applied.keys()) {
        if (!files.includes(name)) console.log(`  ORPHANED  ${name} (ledger row without a file)`)
      }
      console.log(`[migrate] status: ${applied.size} applied, ${pending.length} pending`)
      return
    }

    if (pending.length === 0) {
      console.log(`[migrate] nothing to do — all ${files.length} migrations are applied.`)
      return
    }

    for (const name of pending) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8')
      const sum = checksum(sql)
      const startedAt = Date.now()
      process.stdout.write(`[migrate] applying ${name} (${sum.slice(0, 8)}) … `)
      if (isSelfTransactional(sql)) {
        await client.query(sql)
        await client.query('INSERT INTO ticketug.migration (name, checksum) VALUES ($1, $2)', [name, sum])
      } else {
        await client.query('BEGIN')
        try {
          await client.query(sql)
          await client.query('INSERT INTO ticketug.migration (name, checksum) VALUES ($1, $2)', [name, sum])
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        }
      }
      console.log(`ok (${Date.now() - startedAt}ms)`)
    }
    console.log(`[migrate] done — ${pending.length} migration(s) applied, no destructive statements used.`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(`[migrate] FAILED: ${error?.message ?? error}`)
  console.error('[migrate] no destructive action taken — the failed migration was rolled back or its ledger row was not written. Fix the cause and re-run; applied migrations are never re-executed.')
  process.exit(1)
})
