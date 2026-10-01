import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * The platform control center now lives at `/platform` — the full operational
 * console for platform roles. This route keeps the post-authentication
 * landing (and every older link) working by forwarding; the destination's
 * platform layout re-checks the session and role server-side on every
 * request, exactly as this page used to.
 */
export default function ControlCenterRedirectPage() {
  redirect('/platform')
}
