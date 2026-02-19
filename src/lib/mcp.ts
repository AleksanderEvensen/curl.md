import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchPage } from '#lib/fetch-page.ts'

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'curl.md', version: '1.0.0' })

  server.registerTool(
    'fetch_page',
    {
      title: 'Fetch Page',
      description:
        'Fetch a web page and convert it to markdown. Optionally narrow the content to a specific query.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            'Optional query to narrow down the returned content to relevant sections',
          ),
        url: z
          .string()
          .describe(
            'URL of the web page to fetch (e.g. "https://example.com" or "example.com")',
          ),
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ url, query }) => {
      const parsedUrl = new URL(
        z.parse(
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
        ),
      )

      const result = await fetchPage(parsedUrl, { query })
      return { content: [{ type: 'text' as const, text: result }] }
    },
  )

  return server
}
