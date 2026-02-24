import { env, waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { ImageResponse } from 'workers-og'
import { getDb } from '#lib/db.ts'

export const Route = createFileRoute('/og.png')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const page = url.searchParams.get('page')?.trim() || undefined
        const urlParam = url.searchParams.get('url')?.trim() || undefined

        const [font, fontBold] = await Promise.all([
          loadFont(request, '/fonts/GeistMono-Regular.ttf'),
          loadFont(request, '/fonts/GeistMono-Black.ttf'),
        ])

        const tokensSaved = await getTokensSaved(urlParam)
        const element = urlParam
          ? urlVariant(urlParam, tokensSaved)
          : page === 'playground'
            ? playgroundVariant(tokensSaved)
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
  const teal = '#0cc0aa'
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
        children: [
          node('span', {
            children: `${__HOST__}/`,
            style: { color: '#ededed' },
          }),
          node('span', {
            children: '<url>',
            style: { color: teal },
          }),
        ],
        style: { display: 'flex', fontSize: 48, fontWeight: 900 },
      }),
      node('div', {
        children: 'Fetch any URL as Markdown',
        style: { color: '#a1a1a1', fontSize: 48, marginTop: 12 },
      }),
      ...(tokensSaved > 0
        ? [
            node('div', {
              children: [
                node('span', {
                  children: formatNumber(tokensSaved),
                  style: { color: teal },
                }),
                node('span', {
                  children: '\u00a0tokens saved',
                  style: { color: '#a1a1a1' },
                }),
              ],
              style: { display: 'flex', fontSize: 48, marginTop: 8 },
            }),
            node('div', {
              children: [
                node('span', {
                  children: `$${formatCost(tokensSaved, 3)}`,
                  style: { color: teal },
                }),
                node('span', {
                  children: '\u00a0saved @ $3/M input tokens',
                  style: { color: '#a1a1a1' },
                }),
              ],
              style: { display: 'flex', fontSize: 48, marginTop: 8 },
            }),
          ]
        : []),
    ],
  })
}

function playgroundVariant(tokensSaved: number) {
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
        children: `${__HOST__}/playground`,
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
            children: `open ${__HOST__}/playground`,
            style: { color: '#ededed' },
          }),
        ],
        style: { display: 'flex', fontSize: 48, marginTop: 48 },
      }),
    ],
  })
}

function urlVariant(urlParam: string, tokensSaved: number) {
  const teal = '#0cc0aa'
  const hostname = new URL(
    /^https?:\/\//.test(urlParam) ? urlParam : `https://${urlParam}`,
  ).hostname
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
        children: [
          node('span', {
            children: `${__HOST__}/`,
            style: { color: '#ededed' },
          }),
          node('span', {
            children: hostname,
            style: { color: teal },
          }),
        ],
        style: { display: 'flex', fontSize: 48, fontWeight: 900 },
      }),
      node('div', {
        children: 'Fetch any URL as Markdown',
        style: { color: '#a1a1a1', fontSize: 48, marginTop: 12 },
      }),
      ...(tokensSaved > 0
        ? [
            node('div', {
              children: [
                node('span', {
                  children: formatNumber(tokensSaved),
                  style: { color: teal },
                }),
                node('span', {
                  children: '\u00a0tokens saved',
                  style: { color: '#a1a1a1' },
                }),
              ],
              style: { display: 'flex', fontSize: 48, marginTop: 8 },
            }),
            node('div', {
              children: [
                node('span', {
                  children: `$${formatCost(tokensSaved, 3)}`,
                  style: { color: teal },
                }),
                node('span', {
                  children: '\u00a0saved @ $3/M input tokens',
                  style: { color: '#a1a1a1' },
                }),
              ],
              style: { display: 'flex', fontSize: 48, marginTop: 8 },
            }),
          ]
        : []),
    ],
  })
}

function node(type: string, props: Record<string, unknown>): React.ReactNode {
  return { type, props } as unknown as React.ReactNode
}

async function getTokensSaved(urlParam?: string) {
  const hostname = urlParam
    ? new URL(/^https?:\/\//.test(urlParam) ? urlParam : `https://${urlParam}`)
        .hostname
    : undefined
  const cacheKey = hostname
    ? `stats:tokens_saved:${hostname}`
    : 'stats:tokens_saved'
  const cached = await env.KV.get<number>(cacheKey, 'json')
  if (cached !== null) return cached

  const db = getDb()
  let total: number
  if (hostname) {
    const result = await db
      .selectFrom('request')
      .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
      .where('hostname', '=', hostname)
      .executeTakeFirstOrThrow()
    total = result.total ?? 0
  } else {
    const result = await db
      .selectFrom('request')
      .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
      .executeTakeFirstOrThrow()
    total = result.total ?? 0
  }
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

function formatCost(tokens: number, perMillionDollars: number) {
  const cost = (tokens / 1_000_000) * perMillionDollars
  return cost < 0.01 ? cost.toFixed(4).replace(/0+$/, '0') : cost.toFixed(2)
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

async function loadFont(request: Request, path: string) {
  const url = new URL(path, request.url)
  const response = await env.ASSETS.fetch(url)
  return response.arrayBuffer()
}
