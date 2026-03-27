import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { createClient } from '#db/client.ts'
import { useAnimatedValue } from '#hooks/useAnimatedValue.ts'
import * as Cookie from '#lib/cookie.ts'
import { formatCost } from '#lib/format.ts'
import { rpc } from '#lib/rpc.ts'

export const Route = createFileRoute('/~dash/$login/')({
  loader: ({ context }) =>
    getDashboardData({ data: { entityId: context.entity.id, entityType: context.entity.type } }),
  component: Dashboard,
})

function Dashboard() {
  const { account, entity } = Route.useRouteContext()
  const router = useRouter()
  const loaderData = Route.useLoaderData()
  const fetchDashboard = useServerFn(getDashboardData)

  const { data: dashboard } = useQuery({
    initialData: loaderData,
    queryKey: ['dashboard', entity.id],
    queryFn: () => fetchDashboard({ data: { entityId: entity.id, entityType: entity.type } }),
    refetchInterval: 10_000,
  })

  const logout = useMutation({
    async mutationFn() {
      await rpc.api.auth.logout.$post()
    },
    onSuccess() {
      return router.navigate({ to: '/' })
    },
  })

  const animatedBalance = useAnimatedValue(dashboard.balance_mills, {
    duration: 500,
    from: 'previous',
  })
  const balanceDollars = (animatedBalance / 1000).toFixed(2)
  const animatedTokens = useAnimatedValue(dashboard.tokens_saved, {
    duration: 500,
    from: 'previous',
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {account.avatar_url ? (
            <img
              alt={account.name ?? account.email}
              className="size-8 rounded-full"
              src={account.avatar_url}
            />
          ) : null}
          <div>
            <div className="text-sm font-semibold">{entity.name ?? entity.login}</div>
            <div className="text-gray8 text-xs">
              {entity.type === 'organization' ? 'Organization' : 'Personal'}
            </div>
          </div>
        </div>
        <button
          className="text-gray8 hover:bg-gray1 hover:text-gray10 rounded-md px-3 py-1.5 text-sm disabled:opacity-30"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          type="button"
        >
          Sign Out
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <StatCard label="Tokens Saved" value={Math.round(animatedTokens).toLocaleString()} />
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="~$ Saved" value={`$${formatCost(animatedTokens, 3)}`} />
          <StatCard label="Credits Remaining" value={`$${balanceDollars}`} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold">Payment Method</h2>
        {dashboard.payment_method ? (
          <div className="border-gray2 flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              <IconLucideCreditCard className="text-gray8 size-5" />
              <div>
                <span className="text-sm font-medium capitalize">
                  {dashboard.payment_method.brand}
                </span>
                <span className="text-gray8 ms-2 text-sm">
                  **** {dashboard.payment_method.last4}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-gray3 flex items-center justify-between rounded-lg border border-dashed px-4 py-6">
            <span className="text-gray8 text-sm">No payment method on file</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="border-gray2 rounded-lg border px-4 py-4">
      <div className="text-gray8 text-xs">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold">{props.value}</div>
    </div>
  )
}

const getDashboardData = createServerFn({ method: 'GET' })
  .inputValidator((d: { entityId: string; entityType: 'account' | 'organization' }) => d)
  .handler(async ({ data }) => {
    const request = getRequest()
    const db = createClient(env.DB.connectionString)
    const sessionId = await Cookie.parseSigned(
      request.headers.get('cookie') ?? '',
      env.COOKIE_SECRET,
      'curl.session',
    )
    if (!sessionId) return { balance_mills: 0, payment_method: null, tokens_saved: 0 }

    const table = data.entityType === 'organization' ? 'organization' : 'account'
    const billing = await db
      .selectFrom(table)
      .where('id', '=', data.entityId)
      .select(['balance_mills', 'stripe_customer_id'])
      .executeTakeFirst()

    let paymentMethod: { brand: string; last4: string } | null = null
    if (billing?.stripe_customer_id) {
      const { default: Stripe } = await import('stripe')
      const stripe = new Stripe(env.STRIPE_SECRET_KEY)
      const methods = await stripe.paymentMethods.list({
        customer: billing.stripe_customer_id,
        type: 'card',
        limit: 1,
      })
      const card = methods.data[0]?.card
      if (card) paymentMethod = { brand: card.brand, last4: card.last4 }
    }

    const requestColumn = data.entityType === 'organization' ? 'organization_id' : 'account_id'
    const statsResult = await db
      .selectFrom('request')
      .where(requestColumn, '=', data.entityId)
      .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
      .executeTakeFirst()

    return {
      balance_mills: billing?.balance_mills ?? 0,
      payment_method: paymentMethod,
      tokens_saved: Number(statsResult?.total ?? 0),
    }
  })
