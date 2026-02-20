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
        // TODO: chunk summarization if markdown is too many tokens
        // TODO: add feedback POST endpoint to skill for agents to report bugs/quality issues
        // https://developers.cloudflare.com/workers-ai/features/markdown-conversion

        const json = options.request.headers
          .get('accept')
          ?.includes('application/json')

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
            q: z.string().optional(),
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
          const { markdown, tokensSaved } = await fetchPage(url, {
            fresh: search.fresh,
            query: search.q,
          })

          const requestId = trackRequest(options.request, {
            hostname: url.hostname,
            path: url.pathname,
            query: search.q || null,
            tokens_saved: tokensSaved,
            url: url.href,
          })

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
          const status = /\d{3}/.exec(message)?.[0]
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
  const text = 'content' in body ? body.content : `# Error\n\n${body.error}\n`
  return new Response(text, {
    ...init,
    headers: {
      ...init.headers,
      'access-control-expose-headers': 'x-request-id, x-tokens-saved',
      'content-type': 'text/markdown; charset=utf-8',
    },
  })
}
