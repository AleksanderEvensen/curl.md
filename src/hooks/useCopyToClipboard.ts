import * as React from 'react'

export function useCopyToClipboard(props: { content?: string; timeout?: number } = {}) {
  const { content, timeout = 2_000 } = props
  const [copied, setCopied] = React.useState(false)

  const copy = React.useCallback(
    (text?: string) => {
      const value = text ?? content
      if (value === undefined) return
      navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), timeout)
    },
    [content, timeout],
  )

  return { copied, copy }
}
