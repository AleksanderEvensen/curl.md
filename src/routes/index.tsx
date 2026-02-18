import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: __HOST__, desription: 'Fetch any URL as markdown' }],
  }),
  component: Home,
})

// TODO: add ASCII sequence diagram showing how it works (get html, convert to markdown, summarize, etc.)

function Home() {
  return (
    <>
      <h1 className="text-base font-bold">curl.md</h1>
      <pre className="mt-6 overflow-x-auto p-1 -m-1 minimal-scrollbar">
        <span className="block text-gray7"># Fetch any URL as markdown</span>
        <CopyableCommand command={`curl ${__HOST__}/example.com`}>
          <span className="select-none text-gray8">$ </span>
          <span className="text-gray10">curl</span> {__HOST__}
          <span className="text-green9">/example.com</span>
        </CopyableCommand>
        <span className="mt-4 block text-gray7"># Fetch with prompt</span>
        <CopyableCommand
          command={`curl ${__HOST__}/example.com?prompt=summarize+this+page`}
        >
          <span className="select-none text-gray8">$ </span>
          <span className="text-gray10">curl</span> {__HOST__}
          <span className="text-gray10">/example.com</span>
          <span className="text-amber9">?prompt=summarize+this+page</span>
        </CopyableCommand>
      </pre>
    </>
  )
}

function CopyableCommand(
  props: {
    command: string
  } & React.PropsWithChildren,
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
      className={`block cursor-copy text-start hover:opacity-80`}
      onClick={copy}
      type="button"
    >
      <code>
        {children}
        {copied && (
          <span className="ms-2 text-gray9 text-xs select-none">Copied!</span>
        )}
      </code>
    </button>
  )
}
