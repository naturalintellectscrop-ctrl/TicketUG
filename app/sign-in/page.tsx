import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
import { isSafeInternalPath } from '@/lib/safe-redirect'

// Auth surfaces are utility pages, not search entry points — noindex keeps
// thin/duplicate ("sign in") pages out of the index while links still flow.
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Ticket Uganda account to see your orders and QR tickets.',
  robots: { index: false, follow: true }
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const nextPath = isSafeInternalPath(next) ? next : undefined
  return (
    <AuthShell
      mode="sign-in"
      nextPath={nextPath}
      title="Welcome back"
      lede="Sign in to see your QR tickets, follow your orders, and get back to the events you love."
    >
      <AuthForm mode="sign-in" nextPath={nextPath} />
    </AuthShell>
  )
}
