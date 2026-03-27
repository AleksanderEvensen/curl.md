import { createFileRoute, notFound, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { createClient } from '#db/client.ts'
import * as Cookie from '#lib/cookie.ts'

export const Route = createFileRoute('/~dash/$login')({
  async beforeLoad({ location, params }) {
    const data = await getLayoutData({ data: { login: params.login } })
    if (data === false)
      throw redirect({
        to: '/login',
        search: { next: location.publicHref ?? location.pathname },
      })
    if (!data) throw notFound()
    return data
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-6 pt-6 pb-16 font-sans">
      <Outlet />
    </div>
  )
}

const getLayoutData = createServerFn({ method: 'GET' })
  .inputValidator((d: { login: string }) => d)
  .handler(async ({ data: { login } }) => {
    const request = getRequest()
    const db = createClient(env.DB.connectionString)
    const sessionId = await Cookie.parseSigned(
      request.headers.get('cookie') ?? '',
      env.COOKIE_SECRET,
      'curl.session',
    )
    const accountId = sessionId
      ? ((
          await db
            .selectFrom('session')
            .where('id', '=', sessionId)
            .where('expires_at', '>', new Date())
            .select('account_id')
            .executeTakeFirst()
        )?.account_id ?? null)
      : null
    if (!accountId) return false

    const account = await db
      .selectFrom('account')
      .where('id', '=', accountId)
      .select(['avatar_url', 'email', 'id', 'login', 'name'])
      .executeTakeFirst()
    if (!account) return false

    // Check if login matches the logged-in account
    if (account.login === login)
      return { account, entity: { type: 'account' as const, ...account } }

    // Check if login matches an organization the user belongs to
    const org = await db
      .selectFrom('organization')
      .innerJoin('organization_member', 'organization_member.organization_id', 'organization.id')
      .where('organization.login', '=', login)
      .where('organization.deleted_at', 'is', null)
      .where('organization_member.account_id', '=', accountId)
      .select(['organization.id', 'organization.login', 'organization.name'])
      .executeTakeFirst()
    if (!org) return null

    return { account, entity: { type: 'organization' as const, ...org } }
  })
