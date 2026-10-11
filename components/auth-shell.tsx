import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

type Mode = 'sign-in' | 'sign-up'

/* Decorative QR-style pattern on the stage ticket (finder-corner motif) —
   purely presentational, never rendered as a real code. */
const QR_PATTERN = [
  1, 1, 1, 0, 1, 1, 1,
  1, 0, 1, 0, 1, 0, 1,
  1, 1, 1, 0, 1, 1, 1,
  0, 0, 0, 1, 0, 0, 0,
  1, 1, 1, 0, 1, 1, 1,
  1, 0, 1, 0, 1, 0, 1,
  1, 1, 1, 0, 1, 1, 1,
]

const STAGE_COPY: Record<Mode, { headline: ReactNode; feature: string }> = {
  'sign-in': { headline: <>Good to see you <em>again.</em></>, feature: 'Your tickets, exactly where you left them.' },
  'sign-up': { headline: <>Your first show <em>starts here.</em></>, feature: 'Create once, then show up everywhere.' },
}

/**
 * Split-screen shell for the authentication surfaces: a dark brand stage
 * (decorative ticket art + real product features) on one side, the focused
 * form column on the other. Presentational only — all auth logic stays in
 * AuthForm and the route handlers.
 */
export function AuthShell({
  mode,
  nextPath,
  title,
  lede,
  children,
}: {
  mode: Mode
  nextPath?: string
  title: string
  lede: string
  children: ReactNode
}) {
  const switchHref =
    mode === 'sign-in'
      ? nextPath
        ? `/sign-up?next=${encodeURIComponent(nextPath)}`
        : '/sign-up'
      : nextPath
        ? `/sign-in?next=${encodeURIComponent(nextPath)}`
        : '/sign-in'

  return (
    <main className="auth-split">
      <section className="auth-stage" aria-label="Ticket Uganda — Events Made Easy">
        <div className="stage-brand">
          <span className="stage-brand-tile" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset shipped in /public */}
            <img src="/brand/logo-icon.png" alt="" width={363} height={345} />
          </span>
          <span className="stage-brand-name">Ticket Uganda<small>Events Made Easy</small></span>
        </div>

        <div className="stage-body">
          <p className="stage-headline">{STAGE_COPY[mode].headline}</p>
          <p className="stage-feature">{STAGE_COPY[mode].feature}</p>

          <div className="stage-ticket" aria-hidden="true">
            <div className="ticket-top">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset shipped in /public */}
              <img src="/brand/logo-icon.png" alt="" width={363} height={345} />
              <span className="ticket-name">TICKET UGANDA</span>
              <span className="ticket-admit">ADMIT ONE</span>
            </div>
            <div className="ticket-perf"><i /><i /></div>
            <div className="ticket-mid">
              <span className="ticket-qr">{QR_PATTERN.map((on, index) => <i key={index} className={on ? 'on' : undefined} />)}</span>
              <span className="ticket-details">
                <span className="ticket-field"><span>ORDER</span><strong>UG-2481</strong></span>
                <span className="ticket-field"><span>GATE</span><strong>KLA·03</strong></span>
              </span>
            </div>
            <div className="ticket-barcode" />
          </div>

          <ul className="stage-chips">
            <li className="stage-chip chip-lime">QR tickets verified at the gate</li>
            <li className="stage-chip chip-blue">Mobile Money checkout</li>
            <li className="stage-chip chip-yellow">E-tickets in seconds</li>
          </ul>
        </div>

        <p className="stage-foot">Secure checkout · Instant QR delivery · Events made easy</p>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Link href="/" className="auth-brand" aria-label="Ticket Uganda home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset shipped in /public */}
            <img src="/brand/logo-full.png" alt="Ticket Uganda — Events Made Easy" className="brand-logo" width={1000} height={333} />
          </Link>
        </div>

        <div className="auth-panel-top">
          <Link href="/" className="auth-back"><ArrowLeft size={15} strokeWidth={2.6} aria-hidden />Back to home</Link>
        </div>

        <div className="auth-panel-body">
          <h1>{title}</h1>
          <p className="auth-lede">{lede}</p>

          {children}

          <div className="auth-switch">
            {mode === 'sign-in' ? (
              <>
                <p>New to Ticket Uganda?</p>
                <Link href={switchHref}>Create an account <ArrowUpRight size={14} strokeWidth={2.8} aria-hidden /></Link>
              </>
            ) : (
              <>
                <p>Already have an account?</p>
                <Link href={switchHref}>Sign in instead <ArrowUpRight size={14} strokeWidth={2.8} aria-hidden /></Link>
              </>
            )}
          </div>

          <p className="auth-help">Questions? <Link href="/contact">Talk to our help desk</Link></p>
        </div>
      </section>
    </main>
  )
}
