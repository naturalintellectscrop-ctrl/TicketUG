import { createNeonAuth } from '@neondatabase/auth/next/server'
import { resolveAuthSecret } from '@/lib/auth-secret'

const baseUrl = process.env.NEON_AUTH_BASE_URL ?? process.env.VITE_NEON_AUTH_URL ?? 'http://localhost:3000'
const secret = resolveAuthSecret(process.env)

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
