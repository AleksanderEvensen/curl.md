import * as Sentry from '@sentry/cloudflare'
import serverEntry from '@tanstack/react-start/server-entry'
import { z } from 'zod'
import { api } from '#api.ts'
import { cleanupExpired } from '#crons/cleanup.ts'
import { createClient } from '#db/client.ts'
import { appendVaryAccept, negotiateAccept } from '#lib/accept.ts'
import { processRequestEnrichmentMessage } from '#queues/request-enrichment.ts'
import { processRequestMessage } from '#queues/request.ts'
import { processStripeWebhookMessage } from '#queues/stripe-webhook.ts'

export default Sentry.withSentry<Env, QueueHandlerMessage>(
  (env) => ({
    dsn: env.SELFHOST_API_KEY ? undefined : env.SENTRY_DSN,
    environment: __ENV__,
    release: __GIT_SHA__,
    sendDefaultPii: true,
    tracesSampleRate: 0.01,
  }),
  {
    async fetch(request, env, ctx) {
      const url = new URL(request.url)
      const firstSegment = url.pathname.split('/')[1] ?? ''

      // Enforce HTTPS for app routes while allowing unauthenticated fetch shortcuts over HTTP.
      const httpsResponse = enforceHttps(request, env, url, firstSegment)
      if (httpsResponse) return httpsResponse

      // Route API requests to the Hono API handler
      if (url.pathname.startsWith('/api/')) return api.fetch(new Request(url, request), env, ctx)

      // Serve sheep assets directly so they never fall through to app/API route handling.
      if (url.pathname.startsWith('/sheep/')) return env.ASSETS.fetch(request)

      // Serve known static assets directly from Workers Assets binding
      const staticResponse = getStaticAssetResponse(env, url)
      if (staticResponse) return staticResponse

      // Route dot-segment paths (e.g. curl.md/example.com) to the API handler under /api prefix
      const fetchShortcutResponse = getFetchShortcutResponse(request, env, ctx, url, firstSegment)
      if (fetchShortcutResponse) return fetchShortcutResponse

      // Redirect docs requests to lowercase canonical paths, but preserve case for other routes.
      const docsCanonicalResponse = getDocsCanonicalResponse(url)
      if (docsCanonicalResponse) return docsCanonicalResponse

      // Handle docs .md endpoints
      const docsRequest = (() => ({
        acceptType: getDocsAcceptType(request, url),
        pathname: getDocsMarkdownPathname(url),
      }))()
      const docsResponse = await getDocsResponse(request, env, url, docsRequest)
      if (docsResponse) return docsResponse

      // Validate pathname
      if (
        !(() => {
          try {
            decodeURI(url.pathname)
            return true
          } catch {
            return false
          }
        })()
      )
        return new Response('Bad Request', { status: 400 })

      // Fall through to TanStack Start SSR handler for all other routes (app pages)
      const response = serverEntry.fetch(request, { context: { ctx, env, request } })
      if (docsRequest.acceptType === 'html') return appendVaryAccept(await response)
      return response
    },
    async queue(batch, env) {
      const queueName = (() => {
        // Preview queues have a suffix (e.g. `stripe-webhook-pr25`), strip it
        const previewApex = env.HOST.replace('.curl.md', '')
        if (previewApex) return batch.queue.replace(`-${previewApex}`, '')
        return batch.queue
      })()
      const queue = z.parse(
        z.enum([
          processRequestEnrichmentMessage.queueName,
          processRequestMessage.queueName,
          processStripeWebhookMessage.queueName,
        ]),
        queueName,
      )
      const handler = {
        [processRequestEnrichmentMessage.queueName]: processRequestEnrichmentMessage,
        [processRequestMessage.queueName]: processRequestMessage,
        [processStripeWebhookMessage.queueName]: processStripeWebhookMessage,
      }[queue]
      const db = createClient(env.DB.connectionString)
      for (const message of batch.messages) {
        try {
          await handler(message as never, db)
          message.ack()
        } catch (error) {
          console.error(`Queue message ${message.id} failed:`, error)
          // Emit alert when next retry will move the message into DLQ
          if (message.attempts >= 3)
            Sentry.captureException(error, {
              extra: {
                queue: {
                  attempts: message.attempts,
                  batch_queue: batch.queue,
                  body: message.body,
                  logical_queue: queueName,
                  message_id: message.id,
                },
              },
              tags: { queue: queueName, queue_outcome: 'dead_letter' },
            })
          message.retry()
        }
      }
    },
    scheduled(controller, env, ctx) {
      // TODO: cron union type gen
      // https://github.com/cloudflare/workers-sdk/pull/12740
      const crons = {
        '0 * * * *': cleanupExpired,
      } as const
      const task = crons[controller.cron as keyof typeof crons]
      if (task) ctx.waitUntil(task(env, ctx))
    },
  },
)

type QueueHandlerMessage =
  | processRequestEnrichmentMessage.Body
  | processRequestMessage.Body
  | processStripeWebhookMessage.Body

declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: {
        ctx: ExecutionContext
        env: Env
        request: Request
      }
    }
  }
}

////////////////////////////////////////////////////////////////////////////////////

function enforceHttps(request: Request, env: Env, url: URL, firstSegment: string) {
  // Keep unauthenticated curl fetch paths working over HTTP, but enforce HTTPS elsewhere.
  if (
    (request.headers.get('x-forwarded-proto') ??
      (() => {
        const cfVisitor = request.headers.get('cf-visitor')
        if (!cfVisitor) return
        try {
          return z.parse(z.object({ scheme: z.string() }), JSON.parse(cfVisitor)).scheme
        } catch {
          return
        }
      })() ??
      url.protocol.slice(0, -1)) !== 'http'
  )
    return
  if (url.hostname !== env.HOST) return

  if (!isFetchShortcutPath(firstSegment)) {
    url.protocol = 'https:'
    return new Response(null, { status: 301, headers: { location: url.toString() } })
  }

  if (
    request.headers.has('authorization') ||
    request.headers.has('cookie') ||
    url.searchParams.has('t') ||
    url.searchParams.has('token')
  )
    return new Response('Use HTTPS for authenticated requests', { status: 400 })
}

function getDocsAcceptType(request: Request, url: URL) {
  if (url.pathname.endsWith('.md')) return 'markdown'
  return negotiateAccept(
    request.headers.get('accept'),
    function getAcceptedDocsType(acceptedValue) {
      if (acceptedValue.q <= 0) return null
      if (acceptedValue.type === '*' && acceptedValue.subtype === '*') return 'html'
      if (acceptedValue.type === 'text' && acceptedValue.subtype === '*') return 'html'
      if (acceptedValue.type === 'text' && acceptedValue.subtype === 'html') return 'html'
      if (acceptedValue.type === 'text' && acceptedValue.subtype === 'markdown') return 'markdown'
      return null
    },
  )
}

function getDocsCanonicalResponse(url: URL) {
  const lowercasePathname = url.pathname.toLowerCase()
  if (url.pathname === lowercasePathname) return
  if (lowercasePathname !== '/docs' && !lowercasePathname.startsWith('/docs/')) return
  return new Response(null, {
    status: 301,
    headers: { location: `${lowercasePathname}${url.search}` },
  })
}

function getDocsMarkdownPathname(url: URL) {
  if (url.pathname === '/docs' || url.pathname === '/docs/') return '/docs/index.md'
  if (!url.pathname.startsWith('/docs/')) return
  if (url.pathname.endsWith('.txt')) return
  const normalizedPathname = url.pathname.replace(/\/+$/, '')
  if (normalizedPathname.endsWith('.md')) return normalizedPathname
  return `${normalizedPathname}.md`
}

async function getDocsResponse(
  request: Request,
  env: Env,
  url: URL,
  docsRequest: { acceptType: 'html' | 'markdown' | null; pathname: string | undefined },
) {
  if (!docsRequest.pathname) return
  switch (docsRequest.acceptType) {
    case 'html':
      return
    case 'markdown': {
      const docsMarkdownUrl = new URL(docsRequest.pathname, url)
      docsMarkdownUrl.search = url.search
      const response = env.ASSETS.fetch(new Request(docsMarkdownUrl, request))
      if (!url.pathname.endsWith('.md')) return appendVaryAccept(await response)
      return response
    }
    case null:
      return new Response('Not Acceptable', {
        status: 406,
        headers: { vary: 'Accept' },
      })
  }
}

function getFetchShortcutResponse(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  firstSegment: string,
) {
  if (!isFetchShortcutPath(firstSegment)) return
  const protocolMatch = url.pathname.match(/^\/(https?:\/\/)(.+)/)
  if (protocolMatch) {
    // Redirect protocol-prefixed paths in browsers (e.g. /https://example.com/path → /example.com/path)
    if ((request.headers.get('accept') ?? '').includes('text/html'))
      return new Response(null, {
        status: 301,
        headers: { location: `/${protocolMatch[2]}${url.search}` },
      })
    url.pathname = `/${protocolMatch[2]}`
  }
  url.pathname = `/api${url.pathname}`
  return api.fetch(new Request(url, request), env, ctx)
}

const staticAssets = {
  '/llms.txt': '/llms.txt',
  '/robots.txt': '/robots.txt',
  '/sitemap.xml': '/sitemap.xml',
  '/skills': '/.well-known/skills/index.json',
  '/.well-known/skills': '/.well-known/skills/index.json',
  '/.well-known/skills/curl-md': '/.well-known/skills/curl-md/SKILL.md',
} as const

function getStaticAssetResponse(env: Env, url: URL) {
  const path = url.pathname.replace(/\/+$/, '')
  if (!(path in staticAssets)) return
  if (path === '/robots.txt')
    return (() => {
      const headers = { 'content-type': 'text/plain; charset=utf-8' }
      if (env.HOST !== 'curl.md')
        return new Response(['User-agent: *', 'Disallow: /', ''].join('\n'), { headers })
      return new Response(
        [
          'User-agent: *',
          'Allow: /api/og.png',
          'Disallow: /api/',
          'Disallow: /auth/',
          'Disallow: /credits/',
          'Disallow: /invite/',
          'Disallow: /login',
          'Disallow: /home',
          'Disallow: /docs/*.md',
          '',
          'Sitemap: https://curl.md/sitemap.xml',
          '',
        ].join('\n'),
        { headers },
      )
    })()
  return env.ASSETS.fetch(new URL(staticAssets[path as keyof typeof staticAssets], url))
}

function isFetchShortcutPath(firstSegment: string) {
  return firstSegment.includes('.') || /^https?:$/.test(firstSegment)
}
