import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { flushSync } from 'react-dom'
import { poweredByFooter } from '#lib/markdown.ts'

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
  return (
    <>
      <header className="mb-10">
        <h1 className="text-base font-bold">curl.md</h1>
        <p className="mt-1 text-base text-gray6">Fetch any URL as markdown</p>
      </header>

      <h2 className="text-sm text-gray10">
        <span className="font-medium">Try It Now</span>
        <span className="ms-2 inline-block text-gray6">Just use curl</span>
      </h2>
      <pre className="mt-2 flex flex-col bg-bg2 px-3 pt-2 pb-0.5 whitespace-pre-wrap break-words">
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

      <h2 className="mt-8 text-sm text-gray10">
        <span className="font-medium">Integrate</span>
        <span className="ms-2 inline-block text-gray6">
          Enhance your agents
        </span>
      </h2>
      <pre className="mt-2 flex flex-col bg-bg2 px-3 pt-2 pb-0.5 whitespace-pre-wrap break-words">
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

      <h2 className="mt-8 text-sm text-gray10">
        <span className="font-medium">Playground</span>
        <span className="ms-2 inline-block text-gray6">See for yourself</span>
      </h2>
      <Playground />
    </>
  )
}

const examples = [
  ['react.dev', 'fullstack framework support'],
  ['developer.mozilla.org/docs/Web/API/Fetch_API', 'Response'],
  ['wikipedia.org/wiki/Linux', 'kernel history'],
  ['docs.github.com/en/actions', 'workflow syntax'],
] as const

function Playground() {
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
        className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        ref={formRef}
      >
        <label className="relative">
          <span className="sr-only">URL</span>
          <input
            className="w-full bg-bg2 pe-7 ps-2.5 py-1.5 text-sm placeholder:text-gray7 outline-none"
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            pattern="\S+\.\S+"
            placeholder="url"
            required
            type="text"
            value={url}
          />
          {url && result && !resultHidden && (
            <button
              className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 outline-offset-2 text-gray5 hover:text-gray8"
              onClick={() => {
                setUrl('')
                setQuery('')
                setResultHidden(true)
              }}
              type="button"
            >
              <IconOcticonXCircleFill16 className="size-3.5" />
            </button>
          )}
        </label>
        <div className="flex gap-1.5">
          <label className="relative flex-1">
            <span className="sr-only">Query</span>
            <input
              className="peer w-full bg-bg2 px-3 py-1.5 text-sm placeholder:text-gray7 outline-none"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="q"
              type="text"
              value={query}
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-gray5 peer-[:not(:placeholder-shown)]:hidden">
              optional
            </span>
          </label>
          <button
            className="bg-gray1 dark:bg-gray1/60 px-3 py-1.5 -outline-offset-4 text-xs font-medium text-gray9 hover:bg-gray2 hover:text-gray11 disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            Fetch
          </button>
        </div>
      </form>

      {(result && !resultHidden) || (pending && (!result || resultHidden)) ? (
        <div className="bg-bg2">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray8">
            <span>{pending ? pendingDisplayUrl : result?.fetchedUrl}</span>
            {result && (!pending || refreshingRef.current) && (
              <button
                className="p-0.5 outline-offset-2 hover:text-gray11 data-[spinning]:animate-spin"
                data-spinning={
                  pending && refreshingRef.current ? '' : undefined
                }
                disabled={pending}
                onClick={() => {
                  freshRef.current = true
                  refreshingRef.current = true
                  formRef.current?.requestSubmit()
                }}
                type="button"
              >
                <IconOcticonSync16 className="size-3" />
              </button>
            )}
          </div>
          <pre
            key={result?.fetchedUrl ?? 'pending'}
            className="minimal-scrollbar max-h-96 overflow-auto overscroll-contain px-3 pb-2 text-sm whitespace-pre-wrap break-words"
          >
            {pending && !refreshingRef.current ? (
              <span className="text-gray6 animate-pulse">Fetching</span>
            ) : (
              result?.markdown?.replace(poweredByFooter, '')
            )}
          </pre>
        </div>
      ) : null}

      {(!result || resultHidden) && !pending && (
        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
          {examples.map(([url, q]) => (
            <button
              className="bg-bg2 px-3 py-2 text-start opacity-75 grayscale outline-offset-0 hover:opacity-100 hover:grayscale-0 focus:opacity-100 focus:grayscale-0 sm:opacity-50"
              key={`${url}${q ?? ''}`}
              onClick={() => {
                flushSync(() => {
                  setUrl(url)
                  setQuery(q ?? '')
                })
                formRef.current?.requestSubmit()
              }}
              type="button"
            >
              <span className="block truncate text-gray10">
                {url.split('/')[0]}
              </span>
              {(url.includes('/') || q) && (
                <span className="block truncate">
                  {url.includes('/') && (
                    <span className="text-gray10">
                      /{url.split('/').slice(1).join('/')}
                    </span>
                  )}
                  {q && (
                    <span className="text-gray9">
                      ?q={q.replace(/ /g, '+')}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
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
          className="absolute end-0 top-1/2 -translate-y-[calc(66.67%-1px)] p-1 outline-offset-2 focus-visible:outline-1 focus-visible:outline-gray7 opacity-0 group-hover/cmd:opacity-100 focus-visible:opacity-100 data-[copied]:opacity-100"
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
