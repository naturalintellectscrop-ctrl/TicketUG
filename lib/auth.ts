import { createNeonAuth } from '@neondatabase/auth/next/server'

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000'
const secret = process.env.BETTER_AUTH_SECRET ?? 'development-only-secret-change-me-32-chars'

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret, sessionDataTtl: 300 },
  logLevel: 'warn',
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})

export async function getAuthSession() {
  const { data } = await auth.getSession()
  return data ?? null
}

export async function requireAuthSession() {
  const session = await getAuthSession()
  if (!session?.user) throw new Error('Unauthorized')
  return session
}

export type AuthSession = Awaited<ReturnType<typeof requireAuthSession>>
