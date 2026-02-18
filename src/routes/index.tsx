import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: __HOST__, desription: 'Fetch any URL as markdown' }],
  }),
  component: Home,
})

// TODO: add ASCII sequence diagram showing how it works (get html, convert to markdown, summarize, etc.)
// TODO: show live incrementing usage number on home page
// TODO: og image

function Home() {
  return (
    <>
      <h1 className="text-base font-bold mb-10">curl.md</h1>
      <h2 className="text-sm font-medium text-gray10">
        Try it out <span className="text-gray6">— just use curl</span>
      </h2>
      <div className="mt-2 flex flex-col gap-2 p-1 -m-1">
        <pre className="whitespace-pre-wrap break-words">
          <span className="block text-gray7"># Fetch any URL as markdown</span>
          <CopyableCommand command={`curl ${__HOST__}/react.dev`}>
            curl {__HOST__}
            <span className="text-blue9">/react.dev</span>
          </CopyableCommand>
        </pre>
        <pre className="whitespace-pre-wrap break-words">
          <span className="block text-gray7"># Focus output with query</span>
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
      </div>

      <h2 className="mt-8 text-sm font-medium text-gray10">
        Integrate <span className="text-gray6">— enhance your agents</span>
      </h2>
      <div className="mt-2 flex flex-col gap-2 p-1 -m-1">
        <pre className="whitespace-pre-wrap break-words">
          <span className="block text-gray7">{'# Install CLI'}</span>
          <CopyableCommand command="npm i -g curl.md">
            npm i -g <span className="text-teal9">curl.md</span>
          </CopyableCommand>
        </pre>
        <pre className="whitespace-pre-wrap break-words">
          <span className="block text-gray7">{'# Install agent skill'}</span>
          <CopyableCommand command="npx skills add wevm/curl.md">
            npx skills add <span className="text-teal9">wevm/curl.md</span>
          </CopyableCommand>
        </pre>
        <pre className="whitespace-pre-wrap break-words">
          <span className="block text-gray7">{'# Install MCP tool'}</span>
          <CopyableCommand command={`npx ${__HOST__}/mcp`}>
            npx {__HOST__}
            <span className="text-teal9">/mcp</span>
          </CopyableCommand>
        </pre>
      </div>
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
# Install CLI
$ npm i -g curl.md

# Install agent skill
$ npx skills add wevm/curl.md

# Install MCP tool
$ npx ${host}/mcp
\`\`\`
`
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
    <button
      className="group block cursor-copy text-start"
      onClick={copy}
      type="button"
    >
      <code>
        <span className="select-none text-gray7">$ </span>
        <span className="group-hover:opacity-80">{children}</span>
        {copied && (
          <span className="ms-2 text-gray9 text-xs select-none">Copied!</span>
        )}
      </code>
    </button>
  )
}
