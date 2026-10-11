import type { Metadata } from 'next'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'
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
    <AuthShell
      mode="sign-up"
      nextPath={nextPath}
      title="Create your account"
      lede="One account for every event — buy with Mobile Money and keep every QR ticket in one place."
    >
      <AuthForm mode="sign-up" nextPath={nextPath} />
    </AuthShell>
  )
}
