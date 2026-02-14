export type ConvertResult = {
  markdown: string
  title: string | null
  publish_date: string | null
}

export function extractMetadata(html: string): {
  title: string | null
  publishDate: string | null
} {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : null

  const publishDate =
    extractMetaContent(html, 'property', 'article:published_time') ??
    extractMetaContent(html, 'name', 'datePublished') ??
    extractMetaContent(html, 'name', 'date') ??
    null

  return { title, publishDate }
}

function extractMetaContent(
  html: string,
  attr: string,
  value: string,
): string | undefined {
  const re = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["'][^>]*/?>|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["'][^>]*/?>`,
    'i',
  )
  const match = html.match(re)
  return match?.[1] ?? match?.[2]
}
