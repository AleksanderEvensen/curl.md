import { env, waitUntil } from 'cloudflare:workers'
import geistMonoLatin from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getDb } from '#lib/db.ts'
import { themeScript, useTheme } from '#lib/theme.ts'
import '../styles.css'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        as: 'font',
        crossOrigin: 'anonymous',
        href: geistMonoLatin,
        rel: 'preload',
        type: 'font/woff2',
      },
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
    ],
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
    ],
  }),
  component: RootComponent,
  loader: () => getTokensSaved(),
  shellComponent: RootDocument,
})

function RootComponent() {
  const { theme, mounted, cycle } = useTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <div className="mx-auto max-w-xl px-4 py-16 font-mono text-sm">
        <Outlet />
      </div>
      <div className="start-4 bottom-4 flex gap-2 text-xs text-gray5 max-sm:mx-auto max-sm:justify-center max-sm:py-8 sm:fixed">
        {mounted && (
          <button
            className="cursor-pointer hover:text-gray10"
            onClick={cycle}
            type="button"
          >
            {theme}
          </button>
        )}
        {prNumber(__HOST__) && (
          <a
            className="hover:text-gray10"
            href={`https://github.com/wevm/curl.md/pull/${prNumber(__HOST__)}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            #{prNumber(__HOST__)}
          </a>
        )}
        <a
          className="hover:text-gray10"
          href={commitHref(__GIT_SHA__)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {__GIT_SHA__.slice(0, 7)}
        </a>
        <TokensSaved className="sm:hidden" />
      </div>
      <TokensSaved className="max-sm:hidden sm:fixed" />
    </QueryClientProvider>
  )
}

function commitHref(sha: string) {
  if (sha === 'dev') return 'https://github.com/wevm/curl.md'
  const pr = prNumber(__HOST__)
  if (pr) return `https://github.com/wevm/curl.md/pull/${pr}/commits/${sha}`
  return `https://github.com/wevm/curl.md/commit/${sha}`
}

function prNumber(host: string) {
  return host.match(/^pr(\d+)\./)?.[1]
}

function TokensSaved(props: { className?: string }) {
  const loaderData = Route.useLoaderData()
  const getStats = useServerFn(getTokensSaved)
  const { data } = useQuery({
    initialData: loaderData,
    queryFn: () => getStats(),
    queryKey: ['stats'],
    refetchInterval: 30_000,
  })
  const total = data?.tokens_saved ?? 0
  if (total <= 0) return null
  return (
    <span
      className={`end-4 bottom-4 text-xs text-gray5 ${props.className ?? ''}`}
    >
      <span className="tabular-nums">{formatNumber(total)}</span> tokens saved
    </span>
  )
}

function RootDocument(props: React.PropsWithChildren) {
  const { children } = props
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: theme script is static
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
