import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function SignUpPage() {
  return <main className="auth-page"><h1>Create your TicketUG account</h1><AuthForm mode="sign-up" /><p>Already registered? <Link href="/sign-in">Sign in</Link></p></main>
}
