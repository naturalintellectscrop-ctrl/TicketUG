import { redirect } from 'next/navigation'
import { ScannerPage } from '@/components/scanner-client'
import { getTicketUGContext } from '@/lib/request-context'

export default async function Page() {
  const context = await getTicketUGContext()
  if (!context) redirect('/sign-in?next=/scanner')
  return <ScannerPage />
}
