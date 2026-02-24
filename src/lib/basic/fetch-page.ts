import { env } from 'cloudflare:workers'
import { selfMarkdown } from '#lib/self-markdown.ts'
import { filterSectionsByKeywords } from './chunk-markdown.ts'
import { htmlToMarkdown } from './markdown.ts'

export async function fetchPage(
  url: URL,
  options?: { fresh?: boolean; keywords?: string[]; objective?: string },
): Promise<{
  estimated: boolean
  markdown: string
  tokensCount: number
  tokensSaved: number
}> {
  const { keywords } = options ?? {}

  if (url.hostname === env.HOST) {
    const markdown = selfMarkdown()
    const tokensCount = Math.round(markdown.length / 4)
    return { estimated: false, markdown, tokensCount, tokensSaved: 0 }
  }

  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Upstream returned ${res.status}`)

  const content = await res.text()
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''

  let markdown: string
  let hadHtml = false
  if (contentType.startsWith('text/markdown')) {
    markdown = content
  } else {
    const result = await htmlToMarkdown(content, { baseUrl: url.href })
    markdown = result.markdown
    hadHtml = true
  }

  if (keywords?.length) markdown = filterSectionsByKeywords(markdown, keywords)

  const rawSize = hadHtml ? content.length : markdown.length * 3.5
  const tokensCount = Math.round(markdown.length / 4)
  const tokensSaved = Math.round((rawSize - markdown.length) / 4)
  return { estimated: !hadHtml, markdown, tokensCount, tokensSaved }
}
