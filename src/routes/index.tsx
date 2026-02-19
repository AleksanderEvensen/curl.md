import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { flushSync } from 'react-dom'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: __HOST__, desription: 'Fetch any URL as markdown' }],
  }),
  component: Home,
})

// TODO: add ASCII sequence diagram showing how it works (get html, convert to markdown, summarize, etc.)
// TODO: show live incrementing usage number on home page
// TODO: og image
// TODO: create /changelog page

function Home() {
  return (
    <>
      <h1 className="text-base font-bold mb-10">curl.md</h1>
      <h2 className="text-sm font-medium text-gray10">
        Try it out{' '}
        <span className="ms-1 inline-block text-gray6">Just use curl</span>
      </h2>
      <pre className="mt-2 flex flex-col bg-gray-a1 px-3 py-2 whitespace-pre-wrap break-words">
        <span className="block text-gray8"># Fetch any URL as markdown</span>
        <CopyableCommand command={`curl ${__HOST__}/react.dev`}>
          curl {__HOST__}
          <span className="text-blue9">/react.dev</span>
        </CopyableCommand>
        <span className="block mt-3 text-gray8"># Focus output with query</span>
        <CopyableCommand
          command={`curl ${__HOST__}/react.dev?q=fullstack+support`}
        >
          curl {__HOST__}
          <span className="text-blue9">/react.dev</span>
          <span className="text-purple9">
            ?q=
            <wbr />
            fullstack+support
          </span>
        </CopyableCommand>
      </pre>

      <h2 className="mt-8 text-sm font-medium text-gray10">
        Integrate{' '}
        <span className="ms-1 inline-block text-gray6">
          Enhance your agents
        </span>
      </h2>
      <pre className="mt-2 flex flex-col bg-gray-a1 px-3 py-2 whitespace-pre-wrap break-words">
        <span className="block text-gray8"># Install agent skill</span>
        <CopyableCommand command="npx skills add wevm/curl.md">
          npx skills add <span className="text-teal9">wevm/curl.md</span>
        </CopyableCommand>
        <span className="block mt-3 text-gray8"># Install MCP server</span>
        <CopyableCommand command={`npx add-mcp ${__HOST__}/mcp`}>
          npx add-mcp <span className="text-teal9">{__HOST__}/mcp</span>
        </CopyableCommand>
      </pre>

      <h2 className="mt-8 text-sm font-medium text-gray10">
        Playground{' '}
        <span className="ms-1 inline-block text-gray6">Try it in browser</span>
      </h2>
      <Playground />
    </>
  )
}

export function selfMarkdown() {
  const host = __HOST__
  return `---
title: curl.md
description: Fetch any URL as markdown.
---

# ${host}

Fetch any URL as markdown.

## Try it out

Just use curl.

\`\`\`sh
# Fetch any URL as markdown
$ curl ${host}/react.dev

# Focus output with query
$ curl ${host}/react.dev?q=fullstack+support
\`\`\`

## Integrate

Enhance your agents.

\`\`\`sh
# Install agent skill
$ npx skills add wevm/curl.md

# Install MCP server
$ npx add-mcp ${host}/mcp
\`\`\`
`
}

function Playground() {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [url, setUrl] = React.useState('')
  const [query, setQuery] = React.useState('')
  const freshRef = React.useRef(false)
  const [result, action, pending] = React.useActionState(
    async (_prev: { fetchedUrl: string; markdown: string } | null) => {
      const trimmedUrl = url.trim()
      if (!trimmedUrl) return null
      const q = query.trim()
      const fresh = freshRef.current
      freshRef.current = false
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (fresh) params.set('fresh', '')
      const qs = params.size ? `?${params}` : ''
      const path = `/${trimmedUrl}${qs}`
      const displayUrl = `${__HOST__}/${trimmedUrl}${q ? `?q=${encodeURIComponent(q).replace(/%20/g, '+')}` : ''}`
      try {
        const res = await fetch(path)
        const text = await res.text()
        if (!res.ok) {
          try {
            return {
              fetchedUrl: displayUrl,
              markdown: JSON.stringify(JSON.parse(text), null, 2),
            }
          } catch {}
        }
        return { fetchedUrl: displayUrl, markdown: text }
      } catch {
        return { fetchedUrl: displayUrl, markdown: 'Failed to fetch.' }
      }
    },
    null,
  )

  // wait to show spinner so might seem faster without it if result returned quickly
  const [showSpinner, setShowSpinner] = React.useState(false)
  React.useEffect(() => {
    if (!pending) {
      setShowSpinner(false)
      return
    }
    const id = setTimeout(() => setShowSpinner(true), 750)
    return () => clearTimeout(id)
  }, [pending])

  return (
    <div className="mt-2">
      <form
        action={action}
        className="group/form mb-2 flex flex-col gap-2"
        ref={formRef}
      >
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">URL</span>
            <input
              className="w-full bg-gray-a1 px-3 py-1.5 text-sm placeholder:text-gray7 outline-none"
              inputMode="url"
              onChange={(e) => setUrl(e.target.value)}
              placeholder="url"
              required
              type="text"
              value={url}
            />
          </label>
          <button
            className="hidden bg-gray-a1 px-3 py-1.5 text-sm text-gray11 hover:bg-gray-a2 hover:text-gray12 data-[spinning]:opacity-50 sm:block"
            data-spinning={showSpinner || undefined}
            disabled={
              (pending &&
                !(
                  result &&
                  `${__HOST__}/${url.trim()}` ===
                    result.fetchedUrl.split('?')[0]
                )) ||
              !url.trim()
            }
            type="submit"
          >
            <span className="grid items-center justify-center [&>*]:[grid-area:1/1]">
              <span className={showSpinner ? 'invisible' : ''}>Fetch</span>
              {showSpinner && (
                <IconOcticonSync16 className="size-3.5 animate-spin mx-auto" />
              )}
            </span>
          </button>
        </div>
        <label
          className={`${url ? '' : 'hidden group-focus-within/form:block'}`}
        >
          <span className="sr-only">Query</span>
          <input
            className="w-full bg-gray-a1 px-3 py-1.5 text-sm placeholder:text-gray7 outline-none"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="q (optional)"
            type="text"
            value={query}
          />
        </label>
        <button
          className="bg-gray-a1 px-3 py-1.5 text-sm text-gray11 hover:bg-gray-a2 hover:text-gray12 data-[spinning]:opacity-50 sm:hidden"
          data-spinning={showSpinner || undefined}
          disabled={
            (pending &&
              !(
                result &&
                `${__HOST__}/${url.trim()}` === result.fetchedUrl.split('?')[0]
              )) ||
            !url.trim()
          }
          type="submit"
        >
          <span className="grid items-center justify-center [&>*]:[grid-area:1/1]">
            <span className={showSpinner ? 'invisible' : ''}>Fetch</span>
            {showSpinner && (
              <IconOcticonSync16 className="size-3.5 animate-spin mx-auto" />
            )}
          </span>
        </button>
      </form>

      {result && (
        <div className="bg-gray-a1">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray8">
            <span>{result.fetchedUrl}</span>
            <button
              className={`hover:text-gray11 ${pending && `${__HOST__}/${url.trim()}` === result.fetchedUrl.split('?')[0] ? 'animate-spin' : ''}`}
              disabled={pending}
              onClick={() => {
                freshRef.current = true
                formRef.current?.requestSubmit()
              }}
              type="button"
            >
              <IconOcticonSync16 className="size-3" />
            </button>
          </div>
          <pre
            key={result.fetchedUrl}
            className="minimal-scrollbar max-h-96 overflow-auto overscroll-contain px-3 pb-2 text-sm whitespace-pre-wrap break-words"
          >
            {result.markdown}
          </pre>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
        {(
          [
            ['react.dev', 'fullstack support'],
            ['developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
            ['en.wikipedia.org/wiki/Linux', 'kernel history'],
          ] as const
        ).map(([exampleUrl, exampleQuery]) => (
          <button
            className="text-start text-gray6 dark:text-gray5 hover:text-gray8 focus:text-gray8"
            key={`${exampleUrl}${exampleQuery ?? ''}`}
            onClick={() => {
              flushSync(() => {
                setUrl(exampleUrl)
                setQuery(exampleQuery ?? '')
              })
              formRef.current?.requestSubmit()
            }}
            type="button"
          >
            {exampleUrl}
            {exampleQuery && <span>?q={exampleQuery.replace(/ /g, '+')}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function CopyableCommand(
  props: React.PropsWithChildren<{
    command: string
  }>,
) {
  const { children, command } = props

  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className="group block text-start" onClick={copy} type="button">
      <code>
        <span className="group-hover:opacity-80">{children}</span>
        {copied && (
          <span className="ms-2 text-gray9 text-xs select-none">Copied!</span>
        )}
      </code>
    </button>
  )
}
