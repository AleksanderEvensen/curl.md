export const examples = [
  ['react.dev', 'fullstack support'],
  ['developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
  ['en.wikipedia.org/wiki/Linux', 'kernel history'],
  ['docs.github.com/en/rest', 'rate limiting'],
] as const

export function selfMarkdown() {
  const host = __HOST__
  return `---
title: curl.md
description: Fetch any URL as Markdown.
---

# ${host}

Fetch any URL as Markdown.

## Usage

\`\`\`sh
# Fetch any URL as Markdown
$ curl ${host}/react.dev

# Focus output with query
$ curl ${host}/react.dev?q=fullstack+support

# Pre-filter with keywords
$ curl ${host}/react.dev?q=frameworks&k=Next,Remix,TanStack
\`\`\`

## Install

\`\`\`sh
# Install agent skill
$ npx skills add https://${host}

# Install MCP server
$ npx add-mcp ${host}/mcp
\`\`\`
`
}
