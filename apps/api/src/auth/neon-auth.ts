import { createNeonAuth } from '@neondatabase/auth/next/server'

export const neonAuth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000',
  cookies: { secret: process.env.BETTER_AUTH_SECRET ?? 'development-only-secret-change-me-32-chars', sessionDataTtl: 300 },
  logLevel: 'warn',
})
