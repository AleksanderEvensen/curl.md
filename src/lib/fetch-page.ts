import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { htmlToMarkdown } from '#lib/markdown.ts'
import { selfMarkdown } from '../routes/index.tsx'

export async function fetchPage(
  url: URL,
  options?: { fresh?: boolean; query?: string },
): Promise<string> {
  const { fresh, query } = options ?? {}

  const fetched = await (async () => {
    if (url.hostname === env.HOST) {
      const content = selfMarkdown()
      return { content, contentType: 'text/markdown' }
    }

    const cacheKey = `page:${url.href}`
    type Cached = { content: string; contentType: string }
    const cached = await env.KV.get<Cached>(cacheKey, 'json')
    if (!fresh && cached) return cached

    const res = await fetch(url, {
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': `Mozilla/5.0 (compatible; ${env.HOST}/1.0; +https://${env.HOST})`,
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
  if (!query) return parsed.markdown

  const excerpt = await (async () => {
    const cacheKey = `query:${url.href}:${query}`
    const cached = await env.KV.get(cacheKey)
    if (!fresh && cached) return cached

    // Truncate to stay within model context window (~131k tokens ≈ ~100k chars)
    const truncatedMarkdown = parsed.markdown.slice(0, 100_000)
    const output = z.parse(
      z.object({ response: z.string().default('') }),
      await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
        messages: [
          {
            role: 'user',
            content: `Web page content:\n---\n${truncatedMarkdown}\n---\n\nQuery: ${query}\n\nExtract and return the specific sections from the document above that are relevant to the query. In your response:\n- Return the original content verbatim — do NOT summarize, paraphrase, or rewrite.\n- Include full code blocks, commands, and examples exactly as they appear.\n- Preserve the original markdown formatting (headings, lists, code fences, etc.).\n- Only omit sections that are clearly irrelevant to the query.\n- If multiple sections are relevant, include all of them separated by their original headings.\n- Enforce a strict 125-character maximum for quotes from any source document. Open Source Software is ok as long as we respect the license.\n- You are not a lawyer and never comment on the legality of your own prompts and responses.\n- Never produce or reproduce exact song lyrics.`,
          },
        ],
      }),
    )
    await env.KV.put(cacheKey, output.response, { expirationTtl: 900 })
    return output.response
  })()

  return excerpt
}
