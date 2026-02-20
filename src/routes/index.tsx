import { env, waitUntil } from 'cloudflare:workers'
import * as Query from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import * as React from 'react'
import { getDb } from '#lib/db.ts'
import { poweredByFooter } from '#lib/markdown.ts'
import { useTheme } from '#lib/theme.ts'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: __HOST__, desription: 'Fetch any URL as markdown' }],
  }),
  component: Home,
})

// TODO: add ASCII sequence diagram showing how it works (get html, convert to markdown, summarize, etc.)
// TODO: show live incrementing usage number on home page
// TODO: og image
// TODO: /changelog page
// TODO: status page

function Home() {
  const { theme, mounted, cycle } = useTheme()
  return (
    <>
      <header className="mb-10">
        <h1 className="font-bold text-base">curl.md</h1>
        <p className="mt-1 text-base text-gray6">Fetch any URL as markdown</p>
      </header>

      <h2 className="text-gray10 text-sm" id="try">
        <span className="font-medium">Try It Now</span>
        <span className="ms-2 inline-block text-gray6">Just use curl</span>
      </h2>
      <pre className="mt-2 flex flex-col whitespace-pre-wrap break-words bg-bg2 px-3 pt-2 pb-0.5">
        <CopyableCommand
          className="pb-2"
          command={`curl ${__HOST__}/react.dev`}
          comment="# Fetch any URL as markdown"
        >
          curl {__HOST__}
          <span className="text-gray10">/react.dev</span>
        </CopyableCommand>
        <CopyableCommand
          className="pb-2"
          command={`curl ${__HOST__}/react.dev?q=fullstack+framework+support`}
          comment="# Focus output with query"
        >
          curl {__HOST__}
          <span className="text-gray10">/react.dev</span>
          <span className="text-gray9">
            ?q=
            <wbr />
            fullstack+framework+support
          </span>
        </CopyableCommand>
      </pre>

      <h2 className="mt-8 text-gray10 text-sm" id="integrate">
        <span className="font-medium">Integrate</span>
        <span className="ms-2 inline-block text-gray6">
          Enhance your agents
        </span>
      </h2>
      <pre className="mt-2 flex flex-col whitespace-pre-wrap break-words bg-bg2 px-3 pt-2 pb-0.5">
        <CopyableCommand
          className="pb-2"
          command={`npx skills add https://${__HOST__}`}
          comment="# Install agent skill"
        >
          npx skills add <span className="text-gray10">https://{__HOST__}</span>
        </CopyableCommand>
        <CopyableCommand
          className="pb-2"
          command={`npx add-mcp ${__HOST__}/mcp`}
          comment="# Install MCP server"
        >
          npx add-mcp <span className="text-gray10">{__HOST__}/mcp</span>
        </CopyableCommand>
      </pre>

      <h2 className="mt-8 text-gray10 text-sm" id="playground">
        <span className="font-medium">Playground</span>
        <span className="ms-2 inline-block text-gray6">See for yourself</span>
      </h2>
      <Playground />

      <div className="-mt-1 flex items-center justify-between gap-2.5 text-gray5 text-xs">
        <div className="flex gap-2">
          {prNumber(__HOST__) && (
            <a
              className="flex items-center gap-1 hover:text-gray10"
              href={`https://github.com/wevm/curl.md/pull/${prNumber(__HOST__)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {prNumber(__HOST__)}
            </a>
          )}
          <a
            className="flex items-center gap-1 hover:text-gray10"
            href={commitHref(__GIT_SHA__)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {__GIT_SHA__.slice(0, 7)}
          </a>
          {mounted && (
            <button
              className="flex cursor-pointer items-center gap-1 hover:text-gray10"
              onClick={cycle}
              type="button"
            >
              {theme}
            </button>
          )}
        </div>
        <TokensSaved />
      </div>
    </>
  )
}

function Playground() {
  const queryClient = Query.useQueryClient()
  const formRef = React.useRef<HTMLFormElement>(null)

  const [url, setUrl] = React.useState('')
  const [query, setQuery] = React.useState('')
  const freshRef = React.useRef(false)
  const refreshingRef = React.useRef(false)
  const [resultHidden, setResultHidden] = React.useState(false)

  const [result, action, pending] = React.useActionState(async () => {
    setResultHidden(false)
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return null

    const q = query.trim()
    const fresh = freshRef.current
    freshRef.current = false

    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (fresh) params.set('fresh', '')
    const displayUrl = `${__HOST__}/${trimmedUrl}${q ? `?q=${encodeURIComponent(q).replace(/%20/g, '+')}` : ''}`

    try {
      const res = await fetch(
        `/${trimmedUrl}${params.size ? `?${params}` : ''}`,
      )
      const text = await res.text()
      if (!res.ok) {
        try {
          return {
            fetchedUrl: displayUrl,
            markdown: JSON.stringify(JSON.parse(text), null, 2),
          }
        } catch {}
      }

      const saved = Number(res.headers.get('x-tokens-saved'))
      if (saved > 0)
        queryClient.setQueryData(
          ['stats'],
          (prev: { tokens_saved: number } | undefined) => ({
            tokens_saved: (prev?.tokens_saved ?? 0) + saved,
          }),
        )

      refreshingRef.current = false
      return { fetchedUrl: displayUrl, markdown: text }
    } catch {
      refreshingRef.current = false
      return { fetchedUrl: displayUrl, markdown: 'Failed to fetch.' }
    }
  }, null)

  const trimmedUrl = url.trim()
  const q = query.trim()
  const pendingDisplayUrl = `${__HOST__}/${trimmedUrl}${q ? `?q=${encodeURIComponent(q).replace(/%20/g, '+')}` : ''}`

  return (
    <div className="mt-2">
      <form
        action={action}
        className="mb-1.5 flex flex-col gap-1.5"
        ref={formRef}
      >
        <label className="relative">
          <span className="sr-only">URL</span>
          <input
            className="w-full bg-bg2 px-2.5 py-1.5 text-sm outline-none placeholder:text-gray9"
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            pattern="\S+\.\S+"
            placeholder="url"
            required
            type="text"
            value={url}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Query</span>
          <input
            className="peer w-full bg-bg2 px-3 py-1.5 text-sm outline-none placeholder:text-gray9"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="q"
            type="text"
            value={query}
          />
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray5 text-xs peer-[:not(:placeholder-shown)]:hidden">
            optional
          </span>
        </label>
        <button
          className="bg-gray1 px-3 py-1.5 font-medium text-gray9 text-sm -outline-offset-4 hover:bg-gray2 hover:text-gray11 disabled:opacity-50 dark:bg-gray1/60"
          disabled={pending}
          type="submit"
        >
          Fetch
        </button>
      </form>

      {(result && !resultHidden) || (pending && (!result || resultHidden)) ? (
        <div className="relative mb-1.5 bg-bg2">
          <div className="flex items-center gap-1.5 px-3 py-2 text-gray8 text-sm">
            <IconOcticonMarkdown16 className="size-4 shrink-0 translate-y-px" />
            <span>{pending ? pendingDisplayUrl : result?.fetchedUrl}</span>
          </div>
          <pre
            key={result?.fetchedUrl ?? 'pending'}
            className="minimal-scrollbar max-h-96 overflow-auto overscroll-contain whitespace-pre-wrap break-words px-3 pb-2 text-sm"
          >
            {pending && !refreshingRef.current ? (
              <span className="animate-pulse text-gray6">Fetching</span>
            ) : (
              result?.markdown?.replace(poweredByFooter, '')
            )}
          </pre>
          {result && !pending && (
            <div className="absolute end-4 bottom-2 flex items-center gap-1 rounded bg-bg2/80 p-1 backdrop-blur-sm">
              <CopyButton
                className="p-2 text-gray5 outline-offset-2 hover:text-gray9"
                text={result.markdown?.replace(poweredByFooter, '') ?? ''}
              />
              <button
                className="p-2 text-gray5 outline-offset-2 hover:text-gray9"
                onClick={() => {
                  freshRef.current = true
                  refreshingRef.current = true
                  formRef.current?.requestSubmit()
                }}
                type="button"
              >
                <IconOcticonSync16 className="size-4" />
              </button>
              <button
                className="p-2 text-gray5 outline-offset-2 hover:text-gray8"
                onClick={() => {
                  setUrl('')
                  setQuery('')
                  setResultHidden(true)
                }}
                type="button"
              >
                <IconOcticonXCircleFill16 className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function CopyButton(props: { className?: string; text: string }) {
  const { className, text } = props
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      className={className}
      data-copied={copied ? '' : undefined}
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      type="button"
    >
      {copied ? (
        <IconOcticonCheck16 className="size-4" />
      ) : (
        <IconOcticonClippy16 className="size-4" />
      )}
    </button>
  )
}

function CopyableCommand(
  props: React.PropsWithChildren<{
    className?: string
    command: string
    comment: string
  }>,
) {
  const { children, className, command, comment } = props

  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className={`group/cmd relative block ${className ?? ''}`}>
      <span className="block text-gray8">{comment}</span>
      <span className="relative block">
        <code>{children}</code>
        <button
          className="absolute end-0 top-1/2 -translate-y-[calc(58%-1px)] p-1 opacity-0 outline-offset-2 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-gray7 group-hover/cmd:opacity-100 data-[copied]:opacity-100"
          data-copied={copied ? '' : undefined}
          onClick={copy}
          type="button"
        >
          {copied ? (
            <IconOcticonCheck16 className="size-3.5 text-gray9" />
          ) : (
            <IconOcticonCopy16 className="size-3.5 text-gray6 hover:text-gray9" />
          )}
        </button>
      </span>
    </span>
  )
}

function TokensSaved() {
  const getStats = useServerFn(getTokensSaved)
  const { data } = Query.useQuery({
    queryFn: () => getStats(),
    queryKey: ['stats'],
    refetchInterval: 30_000,
  })
  const total = data?.tokens_saved ?? 0
  if (total <= 0) return null
  return (
    <span className="end-4 bottom-4 flex items-center gap-1 text-gray5 text-xs">
      <span className="tabular-nums">{formatNumber(total)}</span> tokens saved
    </span>
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

function commitHref(sha: string) {
  if (sha === 'dev') return 'https://github.com/wevm/curl.md'
  const pr = prNumber(__HOST__)
  if (pr) return `https://github.com/wevm/curl.md/pull/${pr}/commits/${sha}`
  return `https://github.com/wevm/curl.md/commit/${sha}`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function prNumber(host: string) {
  return host.match(/^pr(\d+)\./)?.[1]
}
