import { env, waitUntil } from 'cloudflare:workers'
import * as Query from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import * as React from 'react'
import { getDb } from '#lib/db.ts'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: __HOST__ },
      { name: 'description', content: 'Fetch any URL as Markdown' },
      { property: 'og:title', content: __HOST__ },
      { property: 'og:description', content: 'Fetch any URL as Markdown' },
      { property: 'og:image', content: `https://${__HOST__}/og.png` },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `https://${__HOST__}` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: __HOST__ },
      { name: 'twitter:description', content: 'Fetch any URL as Markdown' },
      { name: 'twitter:image', content: `https://${__HOST__}/og.png` },
    ],
  }),
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 px-6 pt-16 pb-16 text-lg">
      <h1 className="font-bold">curl.md</h1>
      <p className="text-gray6">Fetch any URL as Markdown</p>
      <TokensSaved />
      <code className="mt-4">
        <span className="select-none text-gray6">$ </span>npx skills add{' '}
        <span className="text-gray10">https://{__HOST__}</span>
      </code>
      <code>
        <span className="select-none text-gray6">$ </span>npx add-mcp{' '}
        <span className="text-gray10">{__HOST__}/mcp</span>
      </code>
      <code>
        <span className="select-none text-gray6">$ </span>curl{' '}
        <span className="text-gray10">https://{__HOST__}/example.com</span>
      </code>
    </div>
  )
}

function TokensSaved() {
  const getStats = useServerFn(getTokensSaved)
  const { data } = Query.useQuery({
    initialData: { tokens_saved: 0 },
    queryFn: () => getStats(),
    queryKey: ['stats'],
    refetchInterval: 30_000,
  })
  const total = data?.tokens_saved ?? 0
  const animated = useCountUp(total)
  return (
    <p className="text-gray6">
      <span className="tabular-nums">{formatNumber(animated, total)}</span>{' '}
      tokens saved
    </p>
  )
}

function useCountUp(target: number, duration = 500) {
  const [value, setValue] = React.useState(0)
  const prev = React.useRef(0)

  React.useEffect(() => {
    if (target === 0) return
    const from = prev.current
    prev.current = target
    const start = performance.now()

    let raf: number
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - t) ** 3 // ease-out cubic
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

const getTokensSaved = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  const origin = request.headers.get('origin')
  if (origin && origin !== `https://${env.HOST}`) throw new Error('Forbidden')

  const cacheKey = 'stats:tokens_saved'
  const cached = await env.KV.get<number>(cacheKey, 'json')
  if (cached !== null) return { tokens_saved: cached }

  const db = getDb()
  const result = await db
    .selectFrom('request')
    .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
    .executeTakeFirstOrThrow()
  const total = result.total ?? 0
  waitUntil(env.KV.put(cacheKey, String(total), { expirationTtl: 60 }))
  return { tokens_saved: total }
})

function formatNumber(n: number, reference?: number): string {
  const r = reference ?? n
  if (r === 0) return `0.00`
  if (r >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (r >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
