export function selfMarkdown() {
  const host = __HOST__
  return `---
title: curl.md
description: Fetch any URL as Markdown
---

# curl.md

Fetch any URL as Markdown

\`\`\`sh
$ curl https://${host}/example.com
\`\`\`

## Install

\`\`\`sh
# Agent skill
$ npx skills add https://${host}

# MCP server
$ npx add-mcp ${host}/mcp
\`\`\`

- [Skill](https://${host}/skills)
- [MCP server](https://${host}/mcp)

## Query Parameters

- \`q\` — objective to extract relevant content from the page
- \`k\` — comma-separated keywords to pre-filter sections

\`\`\`sh
# Extract specific info from docs
$ curl "${host}/docs.github.com/en/webhooks/webhook-events-and-payloads?q=pull+request+review+submitted+event+payload+and+required+headers"

# Pre-filter sections by keywords, then extract
$ curl "${host}/developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch?q=streaming+response+body&k=ReadableStream,getReader"
\`\`\`

## Links

- [GitHub](https://github.com/wevm/curl.md)
- [X](https://x.com/wevm_dev)
- [llms.txt](https://${host}/llms.txt)
`
}
