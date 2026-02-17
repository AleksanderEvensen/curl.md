import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { htmlToMarkdown } from '#lib/markdown.ts'

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      GET: async (options) => {
        const domainRegex =
          /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
        const url = (() => {
          const splat = options.params._splat
          if (!splat) return
          try {
            const parsed = new URL(
              /^https?:\/\//.test(splat) ? splat : `https://${splat}`,
            )
            if (!domainRegex.test(parsed.hostname)) return
            return parsed
          } catch {}
        })()
        if (!url)
          return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })

        try {
          const res = await fetch(url, {
            headers: {
              Accept: 'text/markdown, text/html',
              'User-Agent': `${env.HOST}/1.0`,
            },
            redirect: 'follow',
          })
          if (!res.ok)
            return new Response(
              JSON.stringify({
                error: `Upstream returned ${res.status}`,
                status: res.status,
              }),
              {
                status: 502,
                headers: { 'content-type': 'application/json; charset=utf-8' },
              },
            )

          const markdown = await (async () => {
            if (
              res.headers.get('content-type')?.toLowerCase() === 'text/markdown'
            )
              return await res.text()
            return await htmlToMarkdown(await res.text(), { baseUrl: url.href })
          })()

          // TODO: objective filtering with env.AI
          // TODO: cache content

          const accept = options.request.headers.get('accept') ?? ''
          if (accept.includes('text/markdown'))
            return new Response(markdown, {
              status: 200,
              headers: { 'content-type': 'text/markdown; charset=utf-8' },
            })

          return new Response(JSON.stringify({ markdown }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          })
        } catch {
          return new Response(
            JSON.stringify({ error: `Failed to fetch ${url.hostname}` }),
            {
              status: 502,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            },
          )
        }
      },
    },
  },
})
