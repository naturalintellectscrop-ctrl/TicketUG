import Link from 'next/link'
import { PageHeader } from '@/components/console/page-head'
import { Pagination, StatusPill, UnavailablePanel } from '@/components/platform/ui'
import { listPlatformUsers, PAGE_SIZE } from '@/lib/platform/queries'
import { buildFilterQuery, clampPage, formatDateTime } from '@/lib/platform/format'

export const dynamic = 'force-dynamic'

type SearchParams = { q?: string; page?: string }

const ROLE_TONES: Record<string, 'brand' | 'info'> = { SUPER_ADMIN: 'brand', PLATFORM_ADMIN: 'brand', PLATFORM_SUPPORT: 'brand' }

/** Platform-wide identity explorer. Emails come from the auth schema the
 * platform owns; the view supports investigation (who is this, what did they
 * do) — account suspension does not exist in the security model yet, so no
 * such control is faked here. */
export default async function PlatformUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = clampPage(Number(params.page) || 1, Number.MAX_SAFE_INTEGER, PAGE_SIZE)
  const result = await listPlatformUsers({ q, page })

  return (
    <>
      <PageHeader
        crumb="Directory"
        title="Users"
        lede="Every profile on the platform with its roles and footprint. Roles grant exactly what the authorization model says — this listing never edits them."
      />

      <form className="filter-bar" method="get" action="/platform/users" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Name or email" maxLength={120} /></label>
        <button className="button button-dark" type="submit">Filter</button>
        {result && <span className="filter-count">{result.total.toLocaleString('en-UG')} users</span>}
      </form>

      {result === null ? (
        <UnavailablePanel what="The user list" />
      ) : result.rows.length === 0 ? (
        <p className="muted empty-state">{q ? 'No users match this search.' : 'No users yet.'}</p>
      ) : (
        <>
          <div className="platform-scroll">
            <table className="platform-table">
              <thead><tr><th scope="col">User</th><th scope="col">Platform roles</th><th scope="col" className="num">Workspaces</th><th scope="col" className="num">Orders</th><th scope="col" className="num">Tickets</th><th scope="col">Last sign-in</th></tr></thead>
              <tbody>
                {result.rows.map((user) => (
                  <tr key={user.id}>
                    <td><Link href={`/platform/users/${user.id}`}>{user.displayName || user.email || 'Unnamed profile'}</Link><span className="table-cell-sub">{user.email ?? 'no auth identity'}{user.emailConfirmed ? '' : ' · unconfirmed'}</span></td>
                    <td>{user.platformRoles.length === 0 ? <span className="muted">—</span> : user.platformRoles.map((role) => <StatusPill key={role} tone={ROLE_TONES[role] ?? 'info'}>{role}</StatusPill>)}</td>
                    <td className="num">{user.organizerMemberships}</td>
                    <td className="num">{user.ordersCount.toLocaleString('en-UG')}</td>
                    <td className="num">{user.ticketsCount.toLocaleString('en-UG')}</td>
                    <td>{user.lastSignInAt ? formatDateTime(user.lastSignInAt) : <span className="muted">never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} baseHref={`/platform/users${buildFilterQuery({ q })}`} />
        </>
      )}
    </>
  )
}
