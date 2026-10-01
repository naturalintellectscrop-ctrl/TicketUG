#!/usr/bin/env node
// Platform-admin provisioning (operator tooling) — the secure path for
// granting PLATFORM_SUPPORT / PLATFORM_ADMIN / SUPER_ADMIN to a real account.
//
// Security contract:
//   * NO passwords ever pass through this script. The auth account itself is
//     created in the Supabase Auth dashboard (Project Settings → Auth → Users,
//     or the owner's own signup flow) — the password is the owner's secret.
//   * DATABASE_URL is read from the environment (fail-fast when unset). The
//     script never writes credentials anywhere and never logs more than the
//     target email and role.
//   * Duplicate grants are refused (verification, not blind INSERT).
//   * A ticketug.security_event row records the grant for auditability.
//   * Refuses non-Supabase hosts unless --allow-remote is passed (same
//     discipline as scripts/staging-verify), so a stray DATABASE_URL cannot
//     mutate an unexpected database.
//
// Usage:
//   DATABASE_URL=... node scripts/provision-platform-admin.mjs <email> [--role PLATFORM_ADMIN]
// Roles: PLATFORM_SUPPORT | PLATFORM_ADMIN | SUPER_ADMIN (default PLATFORM_ADMIN)

import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const args = process.argv.slice(2)
const ALLOWED_ROLES = new Set(['PLATFORM_SUPPORT', 'PLATFORM_ADMIN', 'SUPER_ADMIN'])

function fail(message, hint) {
  console.error(`ERROR: ${message}`)
  if (hint) console.error(hint)
  process.exit(1)
}

const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase()
const roleFlag = args.indexOf('--role')
const role = (roleFlag !== -1 ? args[roleFlag + 1] : 'PLATFORM_ADMIN')?.trim().toUpperCase() || 'PLATFORM_ADMIN'
const allowRemote = args.includes('--allow-remote')

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail('usage: node scripts/provision-platform-admin.mjs <email> [--role PLATFORM_ADMIN]')
}
if (!ALLOWED_ROLES.has(role)) {
  fail(`unknown role "${role}"`, `allowed: ${[...ALLOWED_ROLES].join(', ')}`)
}

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
  fail('DATABASE_URL is not set', 'export DATABASE_URL=<supabase session pooler url> and retry')
}

// TLS: strict verification with the bundled Supabase Root CA (mirrors lib/db.ts).
function caCertFor(url) {
  let host = ''
  try { host = new URL(databaseUrl).hostname } catch { fail('DATABASE_URL is not a valid URL') }
  if (!/\.supabase\.(co|com)$/.test(host) && !allowRemote) {
    fail(`refusing non-Supabase host "${host}" without --allow-remote`)
  }
  if (host.endsWith('.supabase.co') || host.endsWith('.supabase.com')) {
    try {
      return readFileSync(path.join(process.cwd(), 'certs', 'supabase-root-2021-ca.pem'))
    } catch (error) {
      fail('cannot read certs/supabase-root-2021-ca.pem', error.message)
    }
  }
  return undefined
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true, ca: caCertFor(databaseUrl) },
  max: 1,
})

async function main() {
  // 1. The Supabase Auth account must already exist (created by the owner).
  const authUser = (await pool.query(
    'SELECT id::text, email FROM auth.users WHERE lower(email) = $1 ORDER BY created_at LIMIT 1',
    [email],
  )).rows[0]
  if (!authUser) {
    fail(
      `no Supabase Auth user found for ${email}`,
      `MANUAL ACTION REQUIRED: create the account in the Supabase dashboard\n` +
      `  (Authentication → Users → Add user → "Create new user", email ${email},\n` +
      `  auto-confirm on; the password is entered there and never shared), then\n` +
      `  re-run this script.`,
    )
  }

  // 2. Resolve (or idempotently create) the ticketug profile for that auth user —
  //    the same contract as lib/user-profile.ts ensureUserProfile.
  const profile = (await pool.query(
    `INSERT INTO ticketug.user_profile (id, auth_user_id, display_name)
     VALUES (gen_random_uuid(), $1, $2)
     ON CONFLICT (auth_user_id) DO NOTHING
     RETURNING id`,
    [authUser.id, email.split('@')[0].slice(0, 200)],
  )).rows[0]
    ?? (await pool.query('SELECT id::text FROM ticketug.user_profile WHERE auth_user_id = $1 LIMIT 1', [authUser.id])).rows[0]
  if (!profile) fail('could not resolve the ticketug user profile')

  // 3. Verify-before-mutate: refuse duplicates.
  const existing = (await pool.query(
    'SELECT role FROM ticketug.platform_role WHERE user_profile_id = $1 ORDER BY created_at',
    [profile.id],
  )).rows.map((row) => row.role)
  if (existing.includes(role)) {
    console.log(`VERIFY: ${email} already holds ${role}. No change made.`)
    console.log(`existing platform roles: ${existing.join(', ') || '(none)'}`)
    return
  }
  if (existing.includes('SUPER_ADMIN') && role !== 'SUPER_ADMIN') {
    console.log(`VERIFY: ${email} already holds SUPER_ADMIN (>= ${role}). No change made.`)
    return
  }

  // 4. Grant + audit row, atomically.
  await pool.query('BEGIN')
  try {
    await pool.query(
      'INSERT INTO ticketug.platform_role (user_profile_id, role) VALUES ($1, $2)',
      [profile.id, role],
    )
    await pool.query(
      `INSERT INTO ticketug.security_event (user_profile_id, event_type)
       VALUES ($1, $2)`,
      [profile.id, `PLATFORM_ROLE_GRANTED:${role}`],
    )
    await pool.query('COMMIT')
  } catch (error) {
    await pool.query('ROLLBACK')
    fail(`grant failed: ${error.message}`)
  }

  console.log(`OK: ${email} now holds ${role}.`)
  console.log(`existing platform roles: ${[...existing, role].join(', ')}`)
  console.log('next: verify at /admin after signing in (PLATFORM_* roles see the control center).')
}

main()
  .catch((error) => fail(error.message))
  .finally(() => pool.end())
