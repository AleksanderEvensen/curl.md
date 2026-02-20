import { createFileRoute } from '@tanstack/react-router'
import { selfMarkdown } from '#lib/self-markdown.ts'

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        new Response(selfMarkdown(), {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
