import Link from 'next/link'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
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
    <main className="auth-page">
      <Link href="/" className="auth-brand" aria-label="Ticket Uganda home">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset shipped in /public */}
        <img src="/brand/logo-full.png" alt="Ticket Uganda — Events Made Easy" className="brand-logo" width={1000} height={333} />
      </Link>
      <h1>Sign in to Ticket Uganda</h1><AuthForm mode="sign-in" nextPath={nextPath} /><p>New to Ticket Uganda? <Link href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : '/sign-up'}>Create an account</Link></p>
    </main>
  )
}
