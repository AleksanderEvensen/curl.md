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

function Home() {
  return (
    <>
      <h1 className="text-base font-bold mb-8">curl.md</h1>
      <h2 className="text-sm font-medium text-gray10">
        Try it out <span className="text-gray7">— just use curl</span>
      </h2>
      <pre className="mt-2 whitespace-pre-wrap break-words p-1 -m-1">
        <span className="block text-gray7"># Fetch any URL as markdown</span>
        <CopyableCommand command={`curl ${__HOST__}/example.com`}>
          curl {__HOST__}
          <span className="text-blue9">/example.com</span>
        </CopyableCommand>
        <span className="mt-4 block text-gray7"># Fetch with prompt</span>
        <CopyableCommand
          command={`curl ${__HOST__}/example.com?prompt=summarize+this+page`}
        >
          curl {__HOST__}
          <span className="text-blue9">/example.com</span>
          <span className="text-purple9">
            ?prompt=
            <wbr />
            summarize+this+page
          </span>
        </CopyableCommand>
      </pre>

      <h2 className="mt-6 text-sm font-medium text-gray10">
        Integrate <span className="text-gray7">— enhance your agents</span>
      </h2>
      <pre className="mt-2 whitespace-pre-wrap break-words p-1 -m-1">
        <span className="block text-gray7"># Install CLI</span>
        <CopyableCommand command="npm i -g curl.md">
          npm i -g <span className="text-teal9">curl.md</span>
        </CopyableCommand>
        <span className="mt-4 block text-gray7"># Install agent skill</span>
        <CopyableCommand command="npx skills add wevm/curl.md">
          npx skills add <span className="text-teal9">wevm/curl.md</span>
        </CopyableCommand>
        <span className="mt-4 block text-gray7"># Install MCP tool</span>
        <CopyableCommand command={`npx ${__HOST__}/mcp`}>
          npx {__HOST__}
          <span className="text-teal9">/mcp</span>
        </CopyableCommand>
      </pre>
    </>
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
