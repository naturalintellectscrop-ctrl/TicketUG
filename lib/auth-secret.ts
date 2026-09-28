const DEV_FALLBACK_SECRET = 'ticketug-local-development-secret-32-chars'

// Fail closed in production (mirrors apps/api/src/auth/neon-auth.ts): a missing
// or short shared secret would let anyone forge Next-side session cookies.
// Both tiers must enforce the same 32-character floor so a weak secret can never
// ship on one surface while the other rejects it.
export function resolveAuthSecret(env: { BETTER_AUTH_SECRET?: string | undefined; NODE_ENV?: string | undefined }): string {
  const secret = env.BETTER_AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  if (env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET must be set to at least 32 characters in production')
  return DEV_FALLBACK_SECRET
}
