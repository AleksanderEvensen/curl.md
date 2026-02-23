import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'
import { z } from 'zod'
import { urlSchema } from '#lib/schemas.ts'

const searchSchema = z.object({
  k: z.string().optional(),
  q: z.string().optional(),
  url: z.string().optional(),
})

export const Route = createFileRoute('/playground')({
  head: () => ({
    meta: [
      { title: `Playground | ${__HOST__}` },
      { name: 'description', content: 'Try fetching any URL as Markdown' },
    ],
  }),
  validateSearch: searchSchema,
  component: Playground,
})

function Playground() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [url, setUrl] = React.useState(search.url ?? '')
  const [objective, setObjective] = React.useState(search.q ?? '')
  const [keywords, setKeywords] = React.useState(search.k ?? '')
  const [fetchedUrl, setFetchedUrl] = React.useState('')
  const [markdown, setMarkdown] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [stats, setStats] = React.useState<{
    tokensCount: number
    tokensSaved: number
  } | null>(null)

  const syncToUrl = React.useCallback(
    (values: { k?: string; q?: string; url?: string }) => {
      navigate({
        to: '/playground',
        search: () => {
          const next = { ...values }
          for (const key of Object.keys(next) as (keyof typeof next)[])
            if (!next[key]) delete next[key]
          return next
        },
        replace: true,
      })
    },
    [navigate],
  )

  // Sync local state to URL
  React.useEffect(() => {
    syncToUrl({ url, q: objective, k: keywords })
  }, [url, objective, keywords, syncToUrl])

  // Auto-submit on load if URL is present
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  React.useEffect(() => {
    if (search.url?.trim())
      fetchMarkdown({ url: search.url, q: search.q, k: search.k })
  }, [])

  const setInputs = (values: { k?: string; q?: string; url?: string }) => {
    if (values.url !== undefined) setUrl(values.url)
    if (values.q !== undefined) setObjective(values.q)
    if (values.k !== undefined) setKeywords(values.k)
  }

  const fetchMarkdown = async (input: {
    k?: string
    q?: string
    url: string
  }) => {
    setLoading(true)
    setError('')
    setMarkdown('')
    setStats(null)

    try {
      const validatedUrl = new URL(z.parse(urlSchema, input.url.trim()))
      const params = new URLSearchParams()
      if (input.q?.trim()) params.set('q', input.q.trim())
      if (input.k?.trim()) params.set('k', input.k.trim())
      const query = params.toString()
      const path = `/${validatedUrl.host}${validatedUrl.pathname}${query ? `?${query}` : ''}`
      setFetchedUrl(`${__HOST__}${path}`)

      const res = await fetch(path, {
        headers: { accept: 'application/json' },
      })
      const data: { content: string } | { error: string } = await res.json()
      if ('error' in data) {
        setError(data.error)
      } else {
        setMarkdown(
          data.content.replace(
            /\n\n---\n\nPowered by \[curl\.md\]\(https:\/\/curl\.md\)$/,
            '',
          ),
        )
        setStats({
          tokensCount: Number(res.headers.get('x-tokens-count') ?? 0),
          tokensSaved: Number(res.headers.get('x-tokens-saved') ?? 0),
        })
      }
    } catch (err) {
      setError(
        err instanceof z.ZodError ? 'Invalid URL' : 'Failed to fetch page',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    fetchMarkdown({ url, q: objective, k: keywords })
  }

  const hasResult = (markdown || error) && fetchedUrl

  const examples = [
    {
      k: 'claude code',
      q: 'how do i install for claude code',
      url: 'vercel.com/docs/agent-resources/vercel-mcp',
    },
    {
      k: 'ReadableStream,getReader',
      q: 'streaming response body',
      url: 'developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
    },
    {
      k: 'D1,bindings',
      q: 'how to query D1 from a worker',
      url: 'developers.cloudflare.com/d1/get-started',
    },
    {
      k: 'd1,planetscale',
      q: 'how do i connect to d1 with planetscale',
      url: 'developers.cloudflare.com/workers/databases/connecting-to-databases',
    },
    {
      k: 'streamText,generateText',
      q: 'how to stream text with the ai sdk',
      url: 'ai-sdk.dev/docs/ai-sdk-core/generating-text',
    },
  ]

  return (
    <div className="flex h-dvh flex-col px-6 pt-16 pb-6 text-lg">
      <div className="mx-auto flex w-full max-w-7xl grow flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold">Playground</h1>
          <p className="text-gray6">Try fetching any URL as Markdown</p>
        </div>

        <div className="flex min-h-0 grow flex-col gap-6 md:flex-row">
          <div className="flex w-full flex-col gap-4 md:max-w-lg">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center">
                <span className="shrink-0 text-gray6">{__HOST__}/</span>
                <input
                  className="w-full bg-gray-a1 px-2 py-1 text-gray10 placeholder:text-gray5"
                  onBlur={() => {
                    const stripped = url.replace(/^https?:\/\//, '')
                    if (stripped !== url) setUrl(stripped)
                  }}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="example.com"
                  type="text"
                  value={url}
                />
              </div>
              <div className="flex items-center">
                <span className="shrink-0 text-gray6">q=</span>
                <input
                  className="w-full bg-gray-a1 px-2 py-1 text-gray10 placeholder:text-gray5"
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="objective (optional)"
                  type="text"
                  value={objective}
                />
              </div>
              <div className="flex items-center">
                <span className="shrink-0 text-gray6">k=</span>
                <input
                  className="w-full bg-gray-a1 px-2 py-1 text-gray10 placeholder:text-gray5"
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="keywords (optional)"
                  type="text"
                  value={keywords}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-gray10 px-3 py-1 text-bg1 hover:bg-gray9 disabled:opacity-50"
                  disabled={loading || !url.trim()}
                  type="submit"
                >
                  {loading ? 'Fetching' : 'Fetch'}
                </button>
                {hasResult && (
                  <button
                    className="px-3 py-1 text-gray6 hover:text-gray10"
                    onClick={() => {
                      setFetchedUrl('')
                      setMarkdown('')
                      setError('')
                      setStats(null)
                      setInputs({ url: '', q: '', k: '' })
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>

            {hasResult && (
              <div className="flex flex-col gap-1 text-gray6 md:hidden">
                {markdown && (
                  <pre className="minimal-scrollbar max-h-[50vh] overflow-auto whitespace-pre-wrap break-words bg-bg2 p-4 text-gray10">
                    {markdown}
                  </pre>
                )}
                {error && (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-red9">
                    {error}
                  </pre>
                )}
              </div>
            )}

            {hasResult && (
              <div className="flex flex-col gap-1 text-gray6">
                <code className="break-all">{fetchedUrl}</code>
                {stats && (
                  <>
                    <span>
                      <span className="text-gray10">
                        {stats.tokensCount.toLocaleString('en-US')}
                      </span>{' '}
                      tokens
                    </span>
                    <span>
                      <span className="text-green9">
                        {stats.tokensSaved.toLocaleString('en-US')}
                      </span>{' '}
                      tokens saved
                    </span>
                  </>
                )}
              </div>
            )}

            <footer className="mt-auto text-gray6">
              <a className="hover:underline" href="/">
                &larr; Home
              </a>
            </footer>
          </div>

          <div className="relative hidden max-h-[calc(100dvh-10rem)] w-full flex-col gap-2 md:flex">
            {error ? (
              <pre className="overflow-x-auto whitespace-pre-wrap text-red9 [scrollbar-gutter:stable]">
                {error}
              </pre>
            ) : markdown ? (
              <>
                <div className="absolute end-2 top-2 z-10">
                  <CopyButton text={markdown} />
                </div>
                <pre className="minimal-scrollbar min-h-0 grow overflow-auto whitespace-pre-wrap break-words bg-bg2 p-4 text-gray10 [scrollbar-gutter:stable]">
                  {markdown}
                </pre>
              </>
            ) : (
              <div className="flex min-h-0 grow flex-col gap-4 bg-bg2 p-4 text-gray5 [scrollbar-gutter:stable]">
                <p>Enter a URL and click Fetch, or try an example:</p>
                {examples.map((example) => (
                  <button
                    className="text-start text-gray6 disabled:opacity-50"
                    disabled={loading}
                    key={example.url}
                    onClick={() => {
                      setInputs(example)
                      fetchMarkdown(example)
                    }}
                    type="button"
                  >
                    <span className="text-gray5">{__HOST__}/</span>
                    {example.url}
                    {example.q && (
                      <>
                        ?q=
                        <span className="text-gray10">{example.q}</span>
                      </>
                    )}
                    {example.k && (
                      <>
                        &k=
                        <span className="text-gray10">{example.k}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyButton(props: { text: string }) {
  const { text } = props
  const [copied, setCopied] = React.useState(false)

  return (
    <button
      className="flex items-center gap-1 text-gray6 hover:text-gray10"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2_000)
      }}
      type="button"
    >
      {copied ? (
        <>
          <IconOcticonCheck16 /> Copied
        </>
      ) : (
        <>
          <IconOcticonCopy16 /> Copy
        </>
      )}
    </button>
  )
}
