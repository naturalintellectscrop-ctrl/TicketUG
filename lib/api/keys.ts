import { createHash, randomBytes } from 'node:crypto'

/**
 * Developer API key material — generation and hashing only.
 *
 * A key looks like `tug_sk_<40 base64url chars>` (~238 bits of entropy).
 * Only its SHA-256 hex digest is ever persisted; the raw key is returned to
 * the creator exactly once. The prefix (first 16 characters) is stored
 * alongside the hash so a key can be *identified* in the dashboard without
 * being usable.
 */

export const API_KEY_PREFIX = 'tug_sk_'

export type GeneratedApiKey = { key: string; prefix: string; keyHash: string }

export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${randomBytes(30).toString('base64url')}`
  return { key, prefix: key.slice(0, 16), keyHash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** Strict shape check for a presented bearer credential. Anything that does
 * not match the issued format is rejected before it reaches the database. */
export function isPlausibleApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length >= API_KEY_PREFIX.length + 40 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value.slice(API_KEY_PREFIX.length))
}
