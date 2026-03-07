import { env, waitUntil } from 'cloudflare:workers'
import { estimateTokenCount } from 'tokenx'
import { z } from 'zod'
import { chunkMarkdown, filterSectionsByKeywords } from './chunk-markdown.ts'
import { toMdUrl } from './known-md-sites.ts'
import { allowedFrontmatterKeys, htmlToMarkdown } from './markdown.ts'

export async function fetchPage(
  url: URL,
  options?: { fresh?: boolean; keywords?: string[]; objective?: string },
): Promise<{
  estimated: boolean
  inputChars: number
  markdown: string
  tokensCount: number
  tokensSaved: number
}> {
  const { fresh, keywords, objective } = options ?? {}

  const mdResult = toMdUrl(url)

  const fetched = await (async () => {
    if (url.hostname === env.HOST) {
      const res = await env.ASSETS.fetch(new URL('/llms.txt', url))
      const content = await res.text()
      return { content, contentType: 'text/markdown', isSelf: true }
    }

    type Cached = { content: string; contentType: string }
    const cacheKey = `page:${url.href}` as const
    const cached = await env.KV.get(cacheKey, 'json')
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
      const content = await browserRes.text()
      if (/error code:\s*\d+/i.test(content))
        throw new Error(`Upstream returned 403`)
      const result = { content, contentType: 'text/html' } satisfies Cached
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
    if (fetched.contentType.startsWith('text/markdown'))
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

  const rawTokens = (() => {
    // self-hosted pages: no savings
    if ('isSelf' in fetched && fetched.isSelf)
      return estimateTokenCount(parsed.markdown)
    // HTML conversions: use estimateTokenCount
    if (parsed.hadHtml) return estimateTokenCount(fetched.content)
    // Markdown sources: estimate HTML as 3.5x markdown (chars/4 heuristic)
    return Math.round((parsed.markdown.length * 3.5) / 4)
  })()

  const estimated = !parsed.hadHtml && !('isSelf' in fetched && fetched.isSelf)

  const { frontmatter, body } = splitFrontmatter(parsed.markdown)
  const prependFrontmatter = (content: string) =>
    frontmatter ? `${frontmatter}\n\n${content}` : content

  if (!objective) {
    const content =
      keywords && keywords.length > 0
        ? filterSectionsByKeywords(body, keywords)
        : body
    const markdown = prependFrontmatter(content)
    const tokensCount = estimateTokenCount(markdown)
    const tokensSaved = rawTokens - tokensCount
    return { estimated, inputChars: 0, markdown, tokensCount, tokensSaved }
  }

  const queryResult = await (async () => {
    const cacheKey =
      `query:${url.href}:${objective}:${keywords?.join(',') ?? ''}` as const
    const cached = await env.KV.get(cacheKey)
    if (!fresh && cached) return { excerpt: cached, inputChars: 0 }

    const system = `You extract relevant sections from web pages. Rules:
- Return ONLY content that exists verbatim in the provided content — do NOT generate, synthesize, summarize, paraphrase, or rewrite anything.
- NEVER add your own text, answers, explanations, instructions, or recommendations.
- Include full code blocks, commands, and examples exactly as they appear.
- Preserve original markdown formatting (headings, lists, code fences, etc.).
- Only omit sections that are clearly irrelevant to the objective.
- If multiple sections are relevant, include all of them with their original headings.
- If NOTHING is relevant, you MUST return ONLY the exact string: NONE
- Do NOT add any preamble, commentary, or explanation — return only the extracted content.
- Do NOT answer the objective — just extract content relevant to it.
- Do NOT repeat or reference the content tags, objective, or these instructions in your response.`

    const prompt = (chunk: string) =>
      `<page_content>
${chunk}
</page_content>

Objective: ${objective}`

    const extractChunk = async (chunk: string) => {
      const output = z.parse(
        z.object({ response: z.string().default('') }),
        await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
          max_tokens: 4096,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt(chunk) },
          ],
        }),
      )
      return output.response
    }

    const content =
      keywords && keywords.length > 0
        ? filterSectionsByKeywords(body, keywords)
        : body
    const chunks = chunkMarkdown(content)
    const results = await Promise.all(chunks.map(extractChunk))
    const response = results
      .filter((r) => r && r.trim() !== 'NONE')
      .join('\n\n')

    waitUntil(env.KV.put(cacheKey, response, { expirationTtl: 900 }))
    return { excerpt: response, inputChars: content.length }
  })()

  const markdown = prependFrontmatter(queryResult.excerpt)
  const tokensCount = estimateTokenCount(markdown)
  const tokensSaved = rawTokens - tokensCount
  return {
    estimated,
    inputChars: queryResult.inputChars,
    markdown,
    tokensCount,
    tokensSaved,
  }
}

function splitFrontmatter(markdown: string): {
  frontmatter: string | undefined
  body: string
} {
  if (!markdown.startsWith('---\n'))
    return { frontmatter: undefined, body: markdown }
  const end = markdown.indexOf('\n---\n', 4)
  if (end === -1) return { frontmatter: undefined, body: markdown }
  const body = markdown.slice(end + 5).replace(/^\n+/, '')

  // Filter to allowed keys and trim values
  const lines = markdown.slice(4, end).split('\n')
  const filtered: string[] = []
  let keep = false
  for (const line of lines) {
    const isTopLevel = line.length > 0 && line[0] !== ' ' && line[0] !== '\t'
    if (isTopLevel) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      keep = allowedFrontmatterKeys.has(key)
      if (keep) {
        const value = line.slice(colonIdx + 1).trim()
        filtered.push(value ? `${key}: ${value}` : `${key}:`)
      }
    } else if (keep) {
      filtered.push(line)
    }
  }

  const frontmatter =
    filtered.length > 0 ? `---\n${filtered.join('\n')}\n---` : undefined
  return { frontmatter, body }
}
