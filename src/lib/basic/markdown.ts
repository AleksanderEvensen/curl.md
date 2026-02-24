import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

export const poweredByFooter =
  '\n\n---\n\nPowered by [curl.md](https://curl.md)'

export const allowedFrontmatterKeys = new Set([
  'author',
  'description',
  'publish_date',
  'site',
  'title',
  'url',
])

export async function htmlToMarkdown(
  html: string,
  _options?: { baseUrl?: string },
): Promise<{ markdown: string; meta: Record<string, string> }> {
  const file = await unified()
    .use(rehypeParse)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify)
    .process(html)
  return { markdown: String(file), meta: {} }
}
