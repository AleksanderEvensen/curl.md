import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { fetchPage } from '#lib/fetch-page.ts'
import { rateLimit } from '#lib/rate-limit.ts'
import { trackRequest } from '#lib/track-request.ts'

export function createMcpServer(request: Request): McpServer {
  const server = new McpServer({ name: 'curl.md', version: '1.0.0' })

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
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ url, keywords, objective }) => {
      if (objective) {
        const { limited } = await rateLimit(request)
        if (limited)
          throw new Error(
            'Rate limit exceeded. Limited to 1,000 requests per day per IP address.',
          )
      }

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

      const { markdown, tokensSaved } = await fetchPage(parsedUrl, {
        keywords,
        objective,
      })

      trackRequest(request, {
        hostname: parsedUrl.hostname,
        keywords: keywords?.join(',') ?? null,
        objective: objective ?? null,
        path: parsedUrl.pathname,
        tokens_saved: tokensSaved,
        url: parsedUrl.href,
        user_agent: 'mcp',
      })

      return { content: [{ type: 'text' as const, text: markdown }] }
    },
  )

  return server
}
