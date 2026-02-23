import { env, waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { ImageResponse } from 'workers-og'
import { getDb } from '#lib/db.ts'

export const Route = createFileRoute('/og.png')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const urlParam = url.searchParams.get('url')?.trim() || undefined

        const [font, fontBold] = await Promise.all([
          loadFont(request, '/fonts/GeistMono-Regular.ttf'),
          loadFont(request, '/fonts/GeistMono-Black.ttf'),
        ])

        const tokensSaved = await getTokensSaved()
        const element = urlParam
          ? urlVariant(urlParam, tokensSaved)
          : indexVariant(tokensSaved)

        if (url.searchParams.has('html'))
          return new Response(toHtmlPreview(element), {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })

        const response = new ImageResponse(element, {
          fonts: [
            { data: font, name: 'Geist Mono', style: 'normal', weight: 400 },
            {
              data: fontBold,
              name: 'Geist Mono',
              style: 'normal',
              weight: 900,
            },
          ],
          format: 'png',
          height: 630,
          width: 1200,
        })

        response.headers.set(
          'cache-control',
          urlParam ? 'public, max-age=3600' : 'public, max-age=300',
        )
        return response
      },
    },
  },
})

function indexVariant(tokensSaved: number) {
  return node('div', {
    style: {
      alignItems: 'flex-start',
      background: '#000000',
      color: '#ededed',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Geist Mono',
      height: '100%',
      justifyContent: 'center',
      paddingBottom: 140,
      paddingLeft: 80,
      paddingRight: 80,
      paddingTop: 80,
      width: '100%',
    },
    children: [
      node('div', {
        children: __HOST__,
        style: { fontSize: 48, fontWeight: 900 },
      }),
      node('div', {
        children: 'Fetch any URL as Markdown',
        style: { color: '#a1a1a1', fontSize: 48, marginTop: 12 },
      }),
      ...(tokensSaved > 0
        ? [
            node('div', {
              children: `${formatNumber(tokensSaved)} tokens saved`,
              style: { color: '#a1a1a1', fontSize: 48, marginTop: 8 },
            }),
          ]
        : []),
      node('div', {
        children: [
          node('span', {
            children: '$',
            style: { color: '#a1a1a1', marginRight: 16 },
          }),
          node('span', {
            children: `curl ${__HOST__}/react.dev`,
            style: { color: '#ededed' },
          }),
        ],
        style: { display: 'flex', fontSize: 48, marginTop: 48 },
      }),
      node('div', {
        children: [
          node('span', {
            children: '$',
            style: { color: '#a1a1a1', marginRight: 16 },
          }),
          node('span', {
            children: `npx skills add https://${__HOST__}`,
            style: { color: '#ededed' },
          }),
        ],
        style: { display: 'flex', fontSize: 48, marginTop: 8 },
      }),
    ],
  })
}

function urlVariant(urlParam: string, tokensSaved: number) {
  return node('div', {
    style: {
      alignItems: 'flex-start',
      background: '#000000',
      color: '#ededed',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Geist Mono',
      height: '100%',
      justifyContent: 'center',
      paddingBottom: 140,
      paddingLeft: 80,
      paddingRight: 80,
      paddingTop: 80,
      width: '100%',
    },
    children: [
      node('div', {
        children: __HOST__,
        style: { fontSize: 48, fontWeight: 900 },
      }),
      node('div', {
        children: 'Fetch any URL as Markdown',
        style: { color: '#a1a1a1', fontSize: 48, marginTop: 12 },
      }),
      ...(tokensSaved > 0
        ? [
            node('div', {
              children: `${formatNumber(tokensSaved)} tokens saved`,
              style: { color: '#a1a1a1', fontSize: 48, marginTop: 8 },
            }),
          ]
        : []),
      node('div', {
        children: [
          node('span', {
            children: '$',
            style: { color: '#a1a1a1', marginRight: 16 },
          }),
          node('span', {
            children: `curl ${__HOST__}/${new URL(/^https?:\/\//.test(urlParam) ? urlParam : `https://${urlParam}`).hostname}`,
            style: { color: '#ededed' },
          }),
        ],
        style: { display: 'flex', fontSize: 48, marginTop: 48 },
      }),
    ],
  })
}

function node(type: string, props: Record<string, unknown>): React.ReactNode {
  return { type, props } as unknown as React.ReactNode
}

async function getTokensSaved() {
  const cacheKey = 'stats:tokens_saved'
  const cached = await env.KV.get<number>(cacheKey, 'json')
  if (cached !== null) return cached

  const db = getDb()
  const result = await db
    .selectFrom('request')
    .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
    .executeTakeFirstOrThrow()
  const total = result.total ?? 0
  waitUntil(env.KV.put(cacheKey, String(total), { expirationTtl: 60 }))
  return total
}

function toHtmlPreview(element: React.ReactNode) {
  const renderNode = (n: unknown): string => {
    if (n == null || typeof n === 'boolean') return ''
    if (typeof n === 'string' || typeof n === 'number') return String(n)
    if (Array.isArray(n)) return n.map(renderNode).join('')
    const { type, props } = n as {
      type: string
      props: Record<string, unknown>
    }
    const style = props.style
      ? ` style="${styleToString(props.style as Record<string, unknown>)}"`
      : ''
    const children = props.children ? renderNode(props.children) : ''
    return `<${type}${style}>${children}</${type}>`
  }
  const body = renderNode(element)
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono&display=swap" rel="stylesheet" />
<style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
</head>
<body>${body}</body>
</html>`
}

const unitless = new Set(['fontWeight', 'opacity', 'zIndex', 'flex', 'order'])

function styleToString(style: Record<string, unknown>) {
  return Object.entries(style)
    .map(
      ([k, v]) =>
        `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${typeof v === 'number' ? `${v}${unitless.has(k) ? '' : 'px'}` : v}`,
    )
    .join(';')
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

async function loadFont(request: Request, path: string) {
  const url = new URL(path, request.url)
  const response = await env.ASSETS.fetch(url)
  return response.arrayBuffer()
}
