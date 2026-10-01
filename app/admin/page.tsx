import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * The platform control center lives at `/platform`. This route only forwards
 * old links; every authorization check happens server-side in the
 * destination's platform layout.
 */
export default function AdminRedirectPage() {
  redirect('/platform')
}
