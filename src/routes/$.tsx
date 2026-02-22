import { env, waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { fetchPage } from '#lib/fetch-page.ts'
import { poweredByFooter } from '#lib/markdown.ts'
import { rateLimit } from '#lib/rate-limit.ts'
import { trackRequest } from '#lib/track-request.ts'

const staticHostnameRe =
  /\.(action|aspx?|cgi|css|eot|gif|html?|ico|jpe?g|json|jsx?|map|php|png|svg|tsx?|ttf|webp|woff2?|xml|ya?ml)$/i

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      GET: async (options) => {
        // TODO: support more content types, like PDF
        // TODO: add feedback POST endpoint to skill for agents to report bugs/quality issues
        // TODO: tests (https://github.com/cloudflare/workers-sdk/pull/11632)
        // https://developers.cloudflare.com/workers-ai/features/markdown-conversion

        const json = options.request.headers
          .get('accept')
          ?.includes('application/json')

        const ua = options.request.headers.get('user-agent') ?? ''
        if (isSocialCrawler(ua)) {
          const raw = options.params._splat ?? ''
          const ogUrl = `https://${__HOST__}/og.png?url=${encodeURIComponent(raw)}`
          return new Response(
            `<!DOCTYPE html>
<html>
<head>
<meta property="og:title" content="${__HOST__}/${escapeHtml(raw)}" />
<meta property="og:description" content="Fetch any URL as markdown" />
<meta property="og:image" content="${ogUrl}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://${__HOST__}/${escapeHtml(raw)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${__HOST__}/${escapeHtml(raw)}" />
<meta name="twitter:description" content="Fetch any URL as markdown" />
<meta name="twitter:image" content="${ogUrl}" />
</head>
<body></body>
</html>`,
            { headers: { 'content-type': 'text/html; charset=utf-8' } },
          )
        }

        const url = new URL(
          z.parse(
            z
              .string()
              .transform((arg) =>
                arg.includes('://') ? arg : `https://${arg}`,
              )
              .pipe(
                z.url({
                  protocol: /^https?$/,
                  hostname: z.regexes.domain,
                  normalize: true,
                }),
              ),
            options.params._splat,
          ),
        )

        // Skip requests where hostname looks like a filename (e.g. favicon.ico, config.json)
        if (staticHostnameRe.test(url.hostname))
          return new Response(null, { status: 404 })

        const search = z.parse(
          z.object({
            fresh: z
              .string()
              .transform(() => true)
              .optional(),
            k: z
              .string()
              .max(200)
              .transform((s) => s.split(/[\s,]+/).filter(Boolean))
              .optional(),
            q: z.string().max(500).optional(),
          }),
          Object.fromEntries(new URL(options.request.url).searchParams),
        )

        let rateLimitHeaders = {}
        if (search.q) {
          const { limited, remaining } = await rateLimit(options.request)
          rateLimitHeaders = { 'x-rate-limit-remaining': String(remaining) }
          if (limited)
            return respond(
              {
                error:
                  'Rate limit exceeded. Limited to 1,000 requests per day per IP address.',
              },
              { status: 429, headers: rateLimitHeaders },
              json,
            )
        }

        try {
          const { estimated, markdown, tokensSaved } = await fetchPage(url, {
            fresh: search.fresh,
            keywords: search.k,
            objective: search.q,
          })

          const requestId = trackRequest(options.request, {
            hostname: url.hostname,
            keywords: search.k?.join(',') || null,
            objective: search.q || null,
            path: url.pathname,
            tokens_saved: tokensSaved,
            url: url.href,
          })

          if (estimated)
            waitUntil(
              env.TOKEN_UPDATE_QUEUE.send({
                markdownLength: markdown.length,
                requestId,
                url: url.href,
              }),
            )

          return respond(
            { content: `${markdown}${poweredByFooter}` },
            {
              status: 200,
              headers: {
                'x-request-id': requestId,
                'x-tokens-saved': String(tokensSaved),
                ...rateLimitHeaders,
              },
            },
            json,
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to fetch page'
          const status = /\b([2-5]\d{2})\b/.exec(message)?.[1]
          return respond(
            { error: message },
            {
              status: status ? Number(status) : 502,
              headers: rateLimitHeaders,
            },
            json,
          )
        }
      },
    },
  },
})

function respond(
  body: { content: string } | { error: string },
  init: ResponseInit,
  json: boolean | undefined,
) {
  if (json) return Response.json(body, init)
  const text =
    'content' in body
      ? body.content
      : `---\nstatus: ${(init.status ?? 500).toString()}\n---\n\n# Error\n\n${body.error}\n`
  return new Response(text, {
    ...init,
    headers: {
      ...init.headers,
      'access-control-expose-headers': 'x-request-id, x-tokens-saved',
      'content-type': 'text/markdown; charset=utf-8',
    },
  })
}

const socialCrawlerRe =
  /Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot/i

function isSocialCrawler(ua: string) {
  return socialCrawlerRe.test(ua)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
