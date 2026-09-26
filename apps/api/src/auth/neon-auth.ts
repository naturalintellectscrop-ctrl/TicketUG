import { createNeonAuth } from '@neondatabase/auth/next/server'

// Fail closed in production (mirrors lib/auth.ts on the Next side): a shipped
// fallback secret would let anyone forge session cookies for the API.
function sessionSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('BETTER_AUTH_SECRET must be set to at least 32 characters in production')
  return 'development-only-secret-change-me-32-chars'
}

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000',
  cookies: { secret: sessionSecret(), sessionDataTtl: 300 },
  logLevel: 'warn',
})
