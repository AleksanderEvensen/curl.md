import { defineRule } from '../mod.ts'

export const cloudflare = defineRule({
  key: 'cloudflare',
  patterns: [new URLPattern({ hostname: 'developers.cloudflare.com' })],
  checks: [{ url: 'https://developers.cloudflare.com/workers/', contains: ['Workers'] }],
  rewrite(url) {
    if (url.pathname.startsWith('/cdn-cgi/')) return
    if (url.pathname === '/') return new URL('https://developers.cloudflare.com/index.md')
    if (url.pathname.endsWith('/index.md')) return
    if (url.pathname.split('/').pop()?.includes('.')) return
    const nextUrl = new URL(url.href)
    nextUrl.pathname = `${nextUrl.pathname.replace(/\/$/, '')}/index.md`
    return nextUrl
  },
  async fetch(input, init, context) {
    const response = await context.fetch(input, {
      ...init,
      headers: { ...init?.headers, Accept: 'text/markdown' },
    })
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/plain')) return response

    const headers = new Headers(response.headers)
    headers.set('content-type', 'text/markdown; charset=utf-8')
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    })
  },
})
