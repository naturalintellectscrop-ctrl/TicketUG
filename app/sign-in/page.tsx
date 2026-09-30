import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
import { isSafeInternalPath } from '@/lib/safe-redirect'

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const nextPath = isSafeInternalPath(next) ? next : undefined
  return <main className="auth-page"><h1>Sign in to Ticket Uganda</h1><AuthForm mode="sign-in" nextPath={nextPath} /><p>New to Ticket Uganda? <Link href={nextPath ? `/sign-up?next=${encodeURIComponent(nextPath)}` : '/sign-up'}>Create an account</Link></p></main>
}
