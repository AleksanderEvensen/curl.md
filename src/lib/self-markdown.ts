const examples = [
  ['react.dev', 'fullstack support'],
  ['developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
  ['en.wikipedia.org/wiki/Linux', 'kernel history'],
  ['docs.github.com/en/rest', 'rate limiting'],
] as const

export function selfMarkdown() {
  const host = __HOST__
  return `---
title: curl.md
description: Fetch any URL as markdown.
---

# ${host}

Fetch any URL as markdown.

## Try It Now

Just use curl

\`\`\`sh
# Fetch any URL as markdown
$ curl ${host}/react.dev

# Focus output with query
$ curl ${host}/react.dev?q=fullstack+support
\`\`\`

## Integrate

Enhance your agents

\`\`\`sh
# Install agent skill
$ npx skills add ${host}

# Install MCP server
$ npx add-mcp ${host}/mcp
\`\`\`

## Playground

See for yourself

\`\`\`sh
${examples.map(([url, query]) => `$ curl ${url}${query ? `?q=${query.replace(/ /g, '+')}` : ''}`).join('\n')}
\`\`\`
`
}
