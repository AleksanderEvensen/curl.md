import * as React from 'react'
import { useCopyToClipboard } from '#hooks/useCopyToClipboard.ts'

export function DashboardCliHelp(
  props: React.PropsWithChildren<{ beforeCommand?: string; command: string; title: string }>,
) {
  const { beforeCommand, children, command, title } = props
  const commands = [beforeCommand, command].filter((value): value is string => Boolean(value))

  return (
    <section className="bg-gray-a1/50 border-gray-a3 rounded-0.5 border px-4 py-4">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <div className="text-gray8 mt-1 text-sm">{children}</div>
        </div>

        <div className="bg-bg1 border-gray-a3 rounded-0.5 overflow-hidden border">
          {commands.map((command, index) => (
            <CopyCommandButton command={command} key={command} separator={index > 0} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CopyCommandButton(props: { command: string; separator?: boolean }) {
  const { copied, copy } = useCopyToClipboard({ content: props.command })

  return (
    <button
      className={`hover:bg-gray-a2/50 focus-visible:ring-blue8 rounded-0.5 flex w-full items-center justify-between gap-4 px-3 py-3 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${props.separator ? 'border-gray-a3 border-t' : ''}`}
      onClick={() => copy()}
      type="button"
    >
      <code className="min-w-0 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
        {renderCommand(props.command)}
      </code>
      <span className="text-gray8 shrink-0">
        {copied ? <IconOcticonCheck16 className="text-teal9" /> : <IconOcticonCopy16 />}
      </span>
    </button>
  )
}

function renderCommand(command: string) {
  return command.split(' ').map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      {index > 0 ? ' ' : null}
      <span className={part === 'curl.md' || part.startsWith('--') ? 'text-gray8' : undefined}>
        {part}
      </span>
    </React.Fragment>
  ))
}
