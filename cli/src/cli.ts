#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    fresh: { short: 'f', type: 'boolean' },
    help: { short: 'h', type: 'boolean' },
    json: { short: 'j', type: 'boolean' },
    keywords: { short: 'k', type: 'string', multiple: true },
    mcp: { type: 'boolean' },
    objective: { short: 'q', type: 'string' },
    version: { short: 'v', type: 'boolean' },
  },
  allowPositionals: true,
})

const version = process.env.CURL_MD_VERSION ?? pkg.version

if (values.version) {
  console.log(version)
} else if (values.mcp) {
  const { startMcp } = await import('./mcp.js')
  await startMcp()
} else if (values.help) {
  printHelp(version)
} else {
  const url = positionals[0] ?? (await readStdin())

  if (!url) {
    printHelp(version)
    process.exit(0)
  }

  const result = z.safeParse(
    z
      .string()
      .transform((arg) => (arg.includes('://') ? arg : `https://${arg}`))
      .pipe(
        z.url({
          hostname: z.regexes.domain,
          normalize: true,
          protocol: /^https?$/,
        }),
      ),
    url,
  )
  if (!result.success) {
    console.error(`Invalid URL: ${url}`)
    process.exit(1)
  }

  const params = new URLSearchParams()
  if (values.objective) params.set('q', values.objective)
  const keywords = values.keywords?.flatMap((k) => k.split(','))
  if (keywords?.length) params.set('k', keywords.join(','))
  if (values.fresh) params.set('fresh', '')

  const query = params.toString()
  const base = process.env.CURL_MD_BASE_URL ?? 'https://curl.md'
  const target = `${base}/${url}${query ? `?${query}` : ''}`

  const headers: Record<string, string> = {}
  if (values.json) headers.Accept = 'application/json'

  const res = await fetch(target, { headers })
  const text = await res.text()

  if (!res.ok) {
    process.stderr.write(text)
    process.exit(1)
  }

  process.stdout.write(text)
}

async function readStdin(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data.trim() || undefined
}

function printHelp(version: string) {
  console.log(`curl.md — Fetch any URL as Markdown
v${version}

Usage:
  curl.md <url> [options]
  echo <url> | curl.md [options]
  curl.md --mcp

Aliases:
  curl-md, curlmd

Options:
  -q, --objective <text>  Narrow content to a specific objective
  -k, --keywords <words>  Pre-filter by keywords (comma-separated)
  -f, --fresh             Force fresh fetch (bypass cache)
  -j, --json              Output as JSON
  --mcp                   Start as MCP stdio server
  -v, --version           Show version
  -h, --help              Show this help

Examples:
  curl.md example.com
  curl.md example.com -q "pricing plans"
  curl.md example.com -k "api,auth"
  curl.md example.com -q "authentication" -k "oauth,jwt"

  curl.md docs.github.com/en/webhooks/webhook-events-and-payloads -q "pull request webhook event payload and actions" -k "pull_request"
  curl.md developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch -q "streaming response body" -k "ReadableStream,getReader"
  curl.md developers.cloudflare.com/d1/get-started -q "how to query D1 from a worker" -k "D1,bindings"
  curl.md ai-sdk.dev/docs/ai-sdk-core/generating-text -q "how to stream text with the ai sdk" -k "streamText,generateText"

MCP:
  curl.md --mcp

  Configure in your MCP client:
  {
    "mcpServers": {
      "curl.md": {
        "command": "npx",
        "args": ["-y", "curl.md", "--mcp"]
      }
    }
  }

Experimental:
  Add a shell alias to use curl.md from curl:

  # bash/zsh
  alias curm='f() { curl "https://curl.md/$1" "\${@:2}"; }; f'

  # fish
  function curm; curl "https://curl.md/$argv[1]" $argv[2..]; end

  Then:
  curm example.com
  curm example.com?q=pricing

Environment:
  CURL_MD_BASE_URL  Base URL (default: https://curl.md)`)
}
