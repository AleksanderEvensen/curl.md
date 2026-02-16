import { createFileRoute } from '@tanstack/react-router'

async function handleRequest({ request }: { request: Request }) {
  const url = new URL(request.url)
  const targetUrl = `https://${url.pathname.slice(1)}`
  const res = await fetch(targetUrl)
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })
}

export const Route = createFileRoute('/$url')({
  server: {
    handlers: {
      GET: handleRequest,
    },
  },
})
