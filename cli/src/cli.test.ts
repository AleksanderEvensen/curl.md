import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, expect, test } from 'vitest'

const exec = promisify(execFile)
const cli = resolve(import.meta.dirname, '..', 'dist', 'cli.js')

test('fetches example.com as markdown', async () => {
  const { stdout } = await exec('node', [cli, 'example.com'], {
    timeout: 30_000,
  })
  expect(stdout).toContain('Example Domain')
})

test('fetches example.com as json', async () => {
  const { stdout } = await exec('node', [cli, 'example.com', '--json'], {
    timeout: 30_000,
  })
  const json = JSON.parse(stdout)
  expect(json.content).toContain('Example Domain')
})

test('prints version', async () => {
  const { stdout } = await exec('node', [cli, '--version'])
  expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
})

test('prints help', async () => {
  const { stdout } = await exec('node', [cli, '--help'])
  expect(stdout).toMatchInlineSnapshot(`
    "curl.md — Fetch any URL as Markdown
    v0.0.1

    Usage:
      curl-md <url> [options]
      echo <url> | curl-md [options]
      curl-md --mcp

    Alias:
      curlmd

    Options:
      -q, --objective <text>  Narrow content to a specific objective
      -k, --keywords <words>  Pre-filter by keywords (comma-separated)
      -f, --fresh             Force fresh fetch (bypass cache)
      -j, --json              Output as JSON
      --mcp                   Start as MCP stdio server
      -v, --version           Show version
      -h, --help              Show this help

    Examples:
      curl-md example.com
      curl-md example.com -q "pricing plans"
      curl-md example.com -k "api,auth"
      curl-md example.com -q "authentication" -k "oauth,jwt"

      curl-md docs.github.com/en/webhooks/webhook-events-and-payloads -q "pull request webhook event payload and actions" -k "pull_request"
      curl-md developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch -q "streaming response body" -k "ReadableStream,getReader"
      curl-md developers.cloudflare.com/d1/get-started -q "how to query D1 from a worker" -k "D1,bindings"
      curl-md ai-sdk.dev/docs/ai-sdk-core/generating-text -q "how to stream text with the ai sdk" -k "streamText,generateText"

    MCP:
      curl-md --mcp

      Configure in your MCP client:
      {
        "mcpServers": {
          "curl-md": {
            "command": "npx",
            "args": ["-y", "curl-md", "--mcp"]
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
      CURL_MD_BASE_URL  Base URL (default: https://curl.md)
    "
  `)
})

test('exits with error for invalid url', async () => {
  await expect(exec('node', [cli, '!!!invalid'])).rejects.toThrow()
})

// MCP

let client: Client | undefined
afterEach(async () => {
  await client?.close()
  client = undefined
})

async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [cli, '--mcp'],
  })
  client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(transport)
  if (!client) throw new Error('client not initialized')
  return client
}

test('mcp: lists fetch_page tool', async () => {
  const client = await createMcpClient()
  const { tools } = await client.listTools()
  expect(tools).toHaveLength(1)
  expect(tools[0]).toMatchObject({ name: 'fetch_page' })
})

test('mcp: fetches example.com', async () => {
  const client = await createMcpClient()
  const result = await client.callTool({
    name: 'fetch_page',
    arguments: { url: 'example.com' },
  })
  expect(result.isError).toBeFalsy()
  expect(result.content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining('Example Domain'),
      }),
    ]),
  )
})
