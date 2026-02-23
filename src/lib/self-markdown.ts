export function selfMarkdown() {
  const host = __HOST__
  return `---
title: curl.md
description: Fetch any URL as Markdown
---

# curl.md

Fetch any URL as Markdown

\`\`\`sh
# Fetch a URL
curl https://${host}/example.com

# Install agent skill
npx skills add https://${host}

# Install MCP server
npx add-mcp ${host}/mcp
\`\`\`

## Usage

\`\`\`sh
# Filter by objective
curl https://${host}/example.com?q=pricing

# Filter by keywords
curl https://${host}/example.com?k=api,auth

# Combine both
curl "https://${host}/example.com?q=authentication&k=oauth,jwt"
\`\`\`

## Links

- [GitHub](https://github.com/wevm/curl.md)
- [MCP server](https://${host}/mcp)
- [Skill](https://${host}/skills)
- [X](https://x.com/wevm_dev)
- [llms.txt](https://${host}/llms.txt)
`
}
