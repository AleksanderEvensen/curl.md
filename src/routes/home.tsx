import * as Query from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import * as React from 'react'
import { createClient } from '#db/client.ts'
import { useAnimatedValue } from '#hooks/useAnimatedValue.ts'
import { formatCost } from '#lib/format.ts'
import { rpc } from '#lib/rpc.ts'
import { getSessionLogin } from '#server/session.ts'

export const Route = createFileRoute('/home')({
  async beforeLoad() {
    const login = await getSessionLogin()
    if (!login) throw redirect({ to: '/' })
  },
  head() {
    const ogImage = rpc.api['og.png'].$url({ query: { page: 'index' } }).toString()
    return {
      meta: [
        { title: `${__HOST__}: Fetch any URL as Markdown` },
        { name: 'description', content: 'Fetch any URL as Markdown' },
        { property: 'og:title', content: __HOST__ },
        { property: 'og:description', content: 'Fetch any URL as Markdown' },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `https://${__HOST__}` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: __HOST__ },
        { name: 'twitter:description', content: 'Fetch any URL as Markdown' },
        { name: 'twitter:image', content: ogImage },
      ],
    }
  },
  component: Home,
})

export function Home() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-2xl flex-col px-6 pb-16">
      <span className="font-pixel fixed start-6 top-6 text-base">
        curl.md<span className="text-gray9 dark:text-gray6">/&lt;url&gt;</span>
      </span>
      <div className="fixed end-6 top-6 flex items-center gap-4">
        <a className="text-gray9 dark:text-gray6 hover:text-gray10 text-sm" href="/llms.txt">
          Docs
        </a>
        <a className="bg-gray10 text-bg1 px-3 py-1.5 text-sm" href="/login">
          Sign in
        </a>
      </div>

      {/* Hero */}
      <TokensSaved />
      <h1 className="mt-8 text-4xl leading-[1.15] font-bold -tracking-[0.01em] md:text-5xl">
        URL to markdown
        <br />
        for agents
      </h1>
      <p className="text-gray9 dark:text-gray6 mt-4 text-lg leading-relaxed">
        Turn the web into optimized, low token output. Free to use. No account needed. Works with
        every agent.
      </p>

      <div className="mt-12 flex flex-col gap-6">
        <div className="flex flex-col">
          <InstallCommand />
          <CostSaved />
        </div>
        <InstallTabs />
        <p className="text-gray6 dark:text-gray5 -mt-3 ps-3 text-xs">
          Install CLI or prefix any URL with `
          <a
            className="hover:underline"
            href="https://curl.md/example.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            curl.md/
          </a>
          `
        </p>
      </div>

      {/* FAQ */}
      <div className="mt-32 flex flex-col">
        <h2 className="text-lg font-bold">FAQ</h2>
        <div className="mt-4 flex flex-col">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm">
              <span className="text-gray6 dark:text-gray5 text-xs transition-transform group-open:rotate-90">
                ▶
              </span>
              What is curl.md?
            </summary>
            <p className="text-gray9 dark:text-gray6 ps-5 pb-3 text-sm leading-relaxed">
              curl.md is a service that fetches any URL and returns clean, optimized markdown. It
              strips away HTML, ads, navigation, and other noise — giving you just the content in a
              format that uses far fewer tokens when sent to an LLM.
            </p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm">
              <span className="text-gray6 dark:text-gray5 text-xs transition-transform group-open:rotate-90">
                ▶
              </span>
              How do I use curl.md?
            </summary>
            <p className="text-gray9 dark:text-gray6 ps-5 pb-3 text-sm leading-relaxed">
              Prefix any URL with <code>curl.md/</code> to fetch it as markdown. You can also
              install the CLI with <code>npm i -g curl.md</code> or add it as an agent skill with{' '}
              <code>curl.md skills add</code>.
            </p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm">
              <span className="text-gray6 dark:text-gray5 text-xs transition-transform group-open:rotate-90">
                ▶
              </span>
              How much does curl.md cost?
            </summary>
            <p className="text-gray9 dark:text-gray6 ps-5 pb-3 text-sm leading-relaxed">
              curl.md is free to use with no account required. For higher usage, prepaid credits are
              available.
            </p>
          </details>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-sm">
              <span className="text-gray6 dark:text-gray5 text-xs transition-transform group-open:rotate-90">
                ▶
              </span>
              Is curl.md open source?
            </summary>
            <p className="text-gray9 dark:text-gray6 ps-5 pb-3 text-sm leading-relaxed">
              Yes! curl.md is open source and available on{' '}
              <a
                className="underline"
                href="https://github.com/wevm/curl.md"
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              .
            </p>
          </details>
        </div>
      </div>
    </div>
  )
}

function TokensSaved() {
  const getStats = useServerFn(getTokensSaved)
  const { data } = Query.useQuery({
    initialData: { tokens_saved: __INITIAL_TOKENS_SAVED__ },
    queryFn() {
      return getStats()
    },
    queryKey: ['stats'],
    refetchInterval: 10_000,
  })
  const total = data?.tokens_saved ?? 0
  const animated = useAnimatedValue(total, {
    duration: 500,
    from: 'previous',
  })
  return (
    <p className="text-gray9 dark:text-gray6 mt-44 flex items-center gap-3 text-sm">
      <span className="border-gray-a5 shrink-0 border px-1 py-0.5 text-xs">LIVE</span>
      <span>
        <span className="tabular-nums">{Math.round(animated).toLocaleString()}</span> tokens saved
      </span>
      <a className="text-gray6 dark:text-gray5 hover:underline" href="/docs/TODO">
        Install now
      </a>
    </p>
  )
}

function CostSaved() {
  const { data } = Query.useQuery({
    initialData: { tokens_saved: __INITIAL_TOKENS_SAVED__ },
    queryKey: ['stats'],
  })
  const total = data?.tokens_saved ?? 0
  const animated = useAnimatedValue(total, {
    duration: 500,
    from: 'previous',
  })
  return (
    <p className="text-gray6 dark:text-gray5 mt-3 ps-3 text-xs tabular-nums">
      Users saved ${formatCost(animated, 3)} @ $3/M input tokens
    </p>
  )
}

function InstallTabs() {
  const [tab, setTab] = React.useState<'bun' | 'curl' | 'npm'>('curl')
  const [copied, setCopied] = React.useState(false)
  const plaintext = {
    bun: 'bun i -g curl.md',
    curl: 'curl -fsSL https://curl.md/install.sh | bash',
    npm: 'npm i -g curl.md',
  }
  const commands = {
    bun: (
      <>
        <span className="text-gray9 dark:text-gray6">bun i -g</span>{' '}
        <span className="text-gray10">curl.md</span>
      </>
    ),
    curl: (
      <>
        <span className="text-gray9 dark:text-gray6">curl -fsSL https://</span>
        <span className="text-gray10">curl.md/install.sh</span>
        <span className="text-gray9 dark:text-gray6"> | bash</span>
      </>
    ),
    npm: (
      <>
        <span className="text-gray9 dark:text-gray6">npm i -g</span>{' '}
        <span className="text-gray10">curl.md</span>
      </>
    ),
  }

  return (
    <div>
      <div className="relative z-10 ms-px -mb-px flex">
        <button
          className="text-gray9 dark:text-gray6 data-[active]:border-gray10 border-b border-transparent px-3 py-2"
          data-active={tab === 'curl' ? '' : undefined}
          onClick={() => setTab('curl')}
          type="button"
        >
          curl
        </button>
        <button
          className="text-gray9 dark:text-gray6 data-[active]:border-gray10 border-b border-transparent px-3 py-2"
          data-active={tab === 'npm' ? '' : undefined}
          onClick={() => setTab('npm')}
          type="button"
        >
          npm
        </button>
        <button
          className="text-gray9 dark:text-gray6 data-[active]:border-gray10 border-b border-transparent px-3 py-2"
          data-active={tab === 'bun' ? '' : undefined}
          onClick={() => setTab('bun')}
          type="button"
        >
          bun
        </button>
      </div>
      <button
        className="border-gray-a3 mt-0 flex w-full items-center justify-between gap-4 border px-3 py-3 text-start transition-opacity hover:opacity-80"
        onClick={() => {
          navigator.clipboard.writeText(plaintext[tab])
          setCopied(true)
          setTimeout(() => setCopied(false), 2_000)
        }}
        type="button"
      >
        <code>{commands[tab]}</code>
        <span className="text-gray9 dark:text-gray6 shrink-0">
          {copied ? <IconOcticonCheck16 className="text-teal9" /> : <IconOcticonCopy16 />}
        </span>
      </button>
    </div>
  )
}

function InstallCommand() {
  const instructions = `I'd like you to set up https://curl.md, the best way to fetch URLs as markdown.

Install CLI and setup skill if I have npm: npm i -g curl.md && curl.md skills add

If not, do this instead: curl -fsSL https://curl.md/install.sh | bash`
  const [copied, setCopied] = React.useState(false)

  return (
    <button
      className="bg-gray10 text-bg1 relative flex items-center px-3 py-3 transition-opacity hover:opacity-90"
      onClick={() => {
        navigator.clipboard.writeText(instructions)
        setCopied(true)
        setTimeout(() => setCopied(false), 5_000)
      }}
      type="button"
    >
      <span>
        {copied ? 'Copied! Now paste into your agent' : 'Copy setup instructions for my agent'}
      </span>
      <span className="absolute end-3">
        {copied ? <IconOcticonCheck16 className="text-teal9" /> : <IconOcticonCopy16 />}
      </span>
    </button>
  )
}

const getTokensSaved = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const request = getRequest()
    const origin = request.headers.get('origin')
    if (origin && origin !== `https://${env.HOST}`) throw new Error('Forbidden')

    const cached = await env.KV.get('stats:tokens_saved')
    if (cached !== null) return { tokens_saved: Number(cached) }

    const db = createClient(env.DB.connectionString)
    const result = await db
      .selectFrom('request')
      .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
      .executeTakeFirstOrThrow()
    return { tokens_saved: Number(result.total ?? 0) }
  } catch {
    return { tokens_saved: __INITIAL_TOKENS_SAVED__ }
  }
})
