import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createFileRoute } from '@tanstack/react-router'
import { createMcpServer } from '#lib/mcp.ts'

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      DELETE: () => new Response('Method not allowed', { status: 405 }),
      GET: () => new Response('Method not allowed', { status: 405 }),
      POST: async (options) => {
        const transport = new WebStandardStreamableHTTPServerTransport()
        const server = createMcpServer()
        await server.connect(transport)
        return transport.handleRequest(options.request)
      },
    },
  },
})
