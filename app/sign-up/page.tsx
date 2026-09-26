import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'
import { isSafeInternalPath } from '@/lib/safe-redirect'

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const nextPath = isSafeInternalPath(next) ? next : undefined
  return <main className="auth-page"><h1>Create your TicketUG account</h1><AuthForm mode="sign-up" nextPath={nextPath} /><p>Already have an account? <Link href={nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : '/sign-in'}>Sign in</Link></p></main>
}
