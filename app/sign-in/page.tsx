import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignInPage() {
  return <main className="auth-page"><h1>Sign in to TicketUG</h1><AuthForm mode="sign-in" /><p>New to TicketUG? <Link href="/sign-up">Create an account</Link></p></main>
}
