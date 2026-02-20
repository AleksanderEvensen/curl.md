import { env, waitUntil } from 'cloudflare:workers'
import { z } from 'zod'
import { toMdUrl } from '#lib/known-md-sites.ts'
import { htmlToMarkdown } from '#lib/markdown.ts'
import { selfMarkdown } from '#lib/self-markdown.ts'

export async function fetchPage(
  url: URL,
  options?: { fresh?: boolean; query?: string },
): Promise<{
  estimated: boolean
  markdown: string
  tokensSaved: number
}> {
  const { fresh, query } = options ?? {}

  const mdResult = toMdUrl(url)

  const fetched = await (async () => {
    if (url.hostname === env.HOST) {
      const content = selfMarkdown()
      return { content, contentType: 'text/markdown', isSelf: true }
    }

    const cacheKey = `page:${url.href}`
    type Cached = { content: string; contentType: string }
    const cached = await env.KV.get<Cached>(cacheKey, 'json')
    if (!fresh && cached) return cached

    const fetchUrl = mdResult?.url ?? url
    const headers = {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': `Mozilla/5.0 (compatible; ${env.HOST}/1.0; +https://${env.HOST})`,
    }
    let res = await fetch(fetchUrl, { headers, redirect: 'follow' })

    // Retry with browser-like UA for sites that block bot User-Agents
    if (res.status === 403) {
      headers['User-Agent'] =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      res = await fetch(fetchUrl, { headers, redirect: 'follow' })
    }

    // Fallback to Browser Rendering API for sites that still block
    if (res.status === 403) {
      const browserRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: fetchUrl.toString(),
            rejectResourceTypes: ['image', 'font', 'media'],
          }),
        },
      )
      if (!browserRes.ok) throw new Error(`Upstream returned 403`)
      const result = {
        content: await browserRes.text(),
        contentType: 'text/html',
      } satisfies Cached
      waitUntil(
        env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 900 }),
      )
      return result
    }

    if (!res.ok) throw new Error(`Upstream returned ${res.status}`)

    const result = {
      content: await res.text(),
      contentType: res.headers.get('content-type')?.toLowerCase() ?? '',
    } satisfies Cached
    waitUntil(
      env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 900 }),
    )
    return result
  })()

  const parsed = await (async () => {
    if (fetched.contentType === 'text/markdown')
      return { markdown: fetched.content, meta: {}, hadHtml: false }
    if (mdResult?.parse) {
      const result = mdResult.parse(fetched.content)
      return {
        markdown: result.markdown,
        meta: result.meta ?? {},
        hadHtml: false,
      }
    }
    const result = await htmlToMarkdown(fetched.content, { baseUrl: url.href })
    return { ...result, hadHtml: true }
  })()

  // Approximate tokens saved vs raw curl of the HTML page.
  // Self-hosted pages: no savings. HTML conversions: use real sizes.
  // Markdown sources: estimate HTML as 3.5x markdown.
  const rawSize =
    'isSelf' in fetched && fetched.isSelf
      ? parsed.markdown.length
      : parsed.hadHtml
        ? fetched.content.length
        : parsed.markdown.length * 3.5

  const estimated = !parsed.hadHtml && !('isSelf' in fetched && fetched.isSelf)

  if (!query) {
    const tokensSaved = Math.round((rawSize - parsed.markdown.length) / 4)
    return { estimated, markdown: parsed.markdown, tokensSaved }
  }

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
    waitUntil(env.KV.put(cacheKey, output.response, { expirationTtl: 900 }))
    return output.response
  })()

  const tokensSaved = Math.round((rawSize - excerpt.length) / 4)
  return { estimated, markdown: excerpt, tokensSaved }
}
