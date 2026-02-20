import { waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getDb } from '#lib/db.ts'
import { fetchPage } from '#lib/fetch-page.ts'
import { poweredByFooter } from '#lib/markdown.ts'

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      GET: async (options) => {
        // TODO: error handling
        // TODO: support more content types, like PDF
        // TODO: chunk summarization if markdown is too many tokens
        // TODO: add feedback POST endpoint to skill for agents to report bugs/quality issues
        // https://developers.cloudflare.com/workers-ai/features/markdown-conversion

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

        const cf = (
          options.request as Request & { cf?: IncomingRequestCfProperties }
        ).cf
        waitUntil(
          getDb()
            .insertInto('request')
            .values({
              id: crypto.randomUUID(),
              city: (cf?.city as string) ?? null,
              country: cf?.country ?? null,
              hostname: url.hostname,
              path: url.pathname,
              query: url.search || null,
              url: url.href,
              user_agent: options.request.headers.get('user-agent'),
            })
            .execute()
            .catch(() => {}),
        )

        try {
          const markdown = await fetchPage(url, {
            fresh: search.fresh,
            query: search.q,
          })
          return new Response(`${markdown}${poweredByFooter}`, {
            status: 200,
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to fetch page'
          const status = /\d{3}/.exec(message)?.[0]
          return Response.json(
            { error: message },
            { status: status ? Number(status) : 502 },
          )
        }
      },
    },
  },
})
