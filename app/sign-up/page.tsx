import Link from 'next/link'
import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
import { isSafeInternalPath } from '@/lib/safe-redirect'

// Auth surfaces are utility pages, not search entry points — noindex keeps
// thin/duplicate ("create account") pages out of the index while links still flow.
export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a Ticket Uganda account to buy event tickets with mobile money and keep every QR ticket in one place.',
  robots: { index: false, follow: true }
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const nextPath = isSafeInternalPath(next) ? next : undefined
  return (
    <main className="auth-page">
      <Link href="/" className="auth-brand" aria-label="Ticket Uganda home">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset shipped in /public */}
        <img src="/brand/logo-full.png" alt="Ticket Uganda — Events Made Easy" className="brand-logo" width={1000} height={333} />
      </Link>
      <h1>Create your Ticket Uganda account</h1><AuthForm mode="sign-up" nextPath={nextPath} /><p>Already have an account? <Link href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : '/sign-in'}>Sign in</Link></p>
    </main>
  )
}
