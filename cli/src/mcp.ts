import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import pkg from '../package.json' with { type: 'json' }

export async function startMcp() {
  const server = new McpServer({ name: 'curl.md', version: pkg.version })

  server.registerTool(
    'fetch_page',
    {
      title: 'Fetch Page',
      description:
        'Fetch a web page and convert it to markdown. Optionally narrow the content to a specific objective.',
      inputSchema: {
        keywords: z
          .array(z.string())
          .optional()
          .describe(
            'Optional keywords to pre-filter content chunks before extraction',
          ),
        objective: z
          .string()
          .optional()
          .describe(
            'Optional objective to narrow down the returned content to relevant sections',
          ),
        url: z
          .string()
          .describe(
            'URL of the web page to fetch (e.g. "https://example.com" or "example.com")',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ url, keywords, objective }) => {
      try {
        const params = new URLSearchParams()
        if (objective) params.set('q', objective)
        if (keywords?.length) params.set('k', keywords.join(','))

        const query = params.toString()
        const base = process.env.CURL_MD_BASE_URL ?? 'https://curl.md'
        const target = `${base}/${url}${query ? `?${query}` : ''}`

        const res = await fetch(target)
        const text = await res.text()

        if (!res.ok)
          return { content: [{ type: 'text' as const, text }], isError: true }
        return { content: [{ type: 'text' as const, text }] }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                error instanceof Error ? error.message : 'Failed to fetch page',
            },
          ],
          isError: true,
        }
      }
    },
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
