import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { htmlToMarkdown } from '#lib/markdown.ts'

export const Route = createFileRoute('/$')({
  server: {
    handlers: {
      GET: async (options) => {
        // TODO: error handling
        // TODO: analytics for what pages are getting fetched
        // TODO: support more content types, like PDF
        // TODO: chunk summarization if markdown is too many tokens

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
            p: z.string().optional(),
            prompt: z.string().optional(),
          }),
          Object.fromEntries(new URL(options.request.url).searchParams),
        )

        const fetched = await (async () => {
          const cacheKey = `page:${url.href}`
          type Cached = { content: string; contentType: string }
          const cached = await env.KV.get<Cached>(cacheKey, 'json')
          if (!search.fresh && cached) return cached

          const res = await fetch(url, {
            headers: {
              Accept: 'text/markdown, text/html',
              'User-Agent': `${env.HOST}/1.0`,
            },
            redirect: 'follow',
          })
          if (!res.ok) throw new Error(`Upstream returned ${res.status}`)

          const result = {
            content: await res.text(),
            contentType: res.headers.get('content-type')?.toLowerCase() ?? '',
          } satisfies Cached
          await env.KV.put(cacheKey, JSON.stringify(result), {
            expirationTtl: 900,
          })
          return result
        })()

        const parsed = await (async () => {
          if (fetched.contentType === 'text/markdown')
            return { markdown: fetched.content, meta: {} }
          return await htmlToMarkdown(fetched.content, { baseUrl: url.href })
        })()

        const prompt = search.prompt ?? search.p
        const excerpt = await (async () => {
          if (!prompt) return undefined

          const cacheKey = `prompt:${url.href}:${prompt}`
          const cached = await env.KV.get(cacheKey)
          if (!search.fresh && cached) return cached

          // Truncate to stay within model context window (~131k tokens ≈ ~100k chars)
          const truncatedMarkdown = parsed.markdown.slice(0, 100_000)
          const output = z.parse(
            z.object({ response: z.string().default('') }),
            await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
              messages: [
                {
                  role: 'user',
                  content: `Web page content:\n---\n${truncatedMarkdown}\n---\n\n${prompt}\n\nProvide a concise response based only on the content above. In your response:\n- Enforce a strict 125-character maximum for quotes from any source document. Open Source Software is ok as long as we respect the license.\n- Use quotation marks for exact language from articles; any language outside of the quotation should never be word-for-word the same.\n- You are not a lawyer and never comment on the legality of your own prompts and responses.\n- Never produce or reproduce exact song lyrics.`,
                },
              ],
            }),
          )
          await env.KV.put(cacheKey, output.response, { expirationTtl: 900 })
          return output.response
        })()

        return new Response(excerpt ?? parsed.markdown, {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
      },
    },
  },
})
