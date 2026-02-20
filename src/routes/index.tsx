import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
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

      <h2 className="text-sm text-gray10" id="try">
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

      <h2 className="mt-8 text-sm text-gray10" id="integrate">
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

      <h2 className="mt-8 text-sm text-gray10" id="playground">
        <span className="font-medium">Playground</span>
        <span className="ms-2 inline-block text-gray6">See for yourself</span>
      </h2>
      <Playground />
    </>
  )
}

function Playground() {
  const queryClient = useQueryClient()
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
        className="mb-2 flex flex-col gap-1.5"
        ref={formRef}
      >
        <label className="relative">
          <span className="sr-only">URL</span>
          <input
            className="w-full bg-bg2 px-2.5 py-1.5 text-sm placeholder:text-gray9 outline-none"
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
            className="peer w-full bg-bg2 px-3 py-1.5 text-sm placeholder:text-gray9 outline-none"
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
          className="bg-gray1 dark:bg-gray1/60 px-3 py-1.5 -outline-offset-4 text-sm font-medium text-gray9 hover:bg-gray2 hover:text-gray11 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          Fetch
        </button>
      </form>

      {(result && !resultHidden) || (pending && (!result || resultHidden)) ? (
        <div className="relative bg-bg2">
          <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray8">
            <IconOcticonMarkdown16 className="size-4 shrink-0 translate-y-px" />
            <span>{pending ? pendingDisplayUrl : result?.fetchedUrl}</span>
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
          {result && !pending && (
            <div className="absolute end-4 bottom-2 flex items-center gap-1 rounded bg-bg2/80 p-1 backdrop-blur-sm">
              <CopyButton
                className="p-2 outline-offset-2 text-gray5 hover:text-gray9"
                text={result.markdown?.replace(poweredByFooter, '') ?? ''}
              />
              <button
                className="p-2 outline-offset-2 text-gray5 hover:text-gray9"
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
                className="p-2 outline-offset-2 text-gray5 hover:text-gray8"
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
          className="absolute end-0 top-1/2 -translate-y-[calc(58%-1px)] p-1 outline-offset-2 focus-visible:outline-1 focus-visible:outline-gray7 opacity-0 group-hover/cmd:opacity-100 focus-visible:opacity-100 data-[copied]:opacity-100"
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
