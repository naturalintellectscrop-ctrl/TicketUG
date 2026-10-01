import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * The platform control center now lives inside the signed-in workspace at
 * `/account/control-center` — the owner signs in like any other user and is
 * taken there automatically. This route only forwards old links; every
 * authorization check happens server-side in the destination page.
 */
export default function AdminRedirectPage() {
  redirect('/account/control-center')
}
