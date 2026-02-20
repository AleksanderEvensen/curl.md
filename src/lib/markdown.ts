import type { Element, Root } from 'hast'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import type { VFile } from 'vfile'

export const poweredByFooter =
  '\n\n---\n\nPowered by [curl.md](https://curl.md)'

export async function htmlToMarkdown(
  html: string,
  options?: { baseUrl?: string },
): Promise<{ markdown: string; meta: Record<string, string> }> {
  const file = await unified()
    .use(rehypeParse)
    .use(rehypeExtractMeta, options?.baseUrl)
    .use(rehypeStripNoise)
    .use(rehypeResolveLinks, options?.baseUrl)
    .use(rehypeStripEmpty)
    .use(rehypePreNewlines)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify)
    .process(html)
  const meta = (file.data.meta as Record<string, string> | undefined) ?? {}
  const frontmatter =
    Object.keys(meta).length > 0
      ? Object.entries(meta)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n')
      : undefined
  const markdown = frontmatter
    ? `---\n${frontmatter}\n---\n\n${String(file)}`
    : String(file)
  return { markdown, meta }
}

const metaPropertyMap: Record<string, string> = {
  'article:published_time': 'publish_date',
  author: 'author',
  date: 'publish_date',
  description: 'description',
  'og:description': 'description',
  'og:site_name': 'site',
  pubdate: 'publish_date',
}

function rehypeExtractMeta(baseUrl?: string) {
  return (tree: Root, file: VFile) => {
    const html = tree.children.find(
      (n): n is Element => n.type === 'element' && n.tagName === 'html',
    )
    const head = html?.children.find(
      (n): n is Element => n.type === 'element' && n.tagName === 'head',
    )
    if (!head) return

    const meta: Record<string, string> = {}
    for (const node of head.children) {
      if (node.type !== 'element') continue
      if (node.tagName === 'title') {
        const text = node.children.find((c) => c.type === 'text')
        if (text?.type === 'text') meta.title = text.value
      }
      if (node.tagName === 'meta') {
        const key =
          (node.properties.name as string | undefined) ??
          (node.properties.property as string | undefined)
        const content = node.properties.content as string | undefined
        if (!key || !content) continue
        const frontmatterKey = metaPropertyMap[key]
        if (frontmatterKey) meta[frontmatterKey] ??= content
      }
      if (
        node.tagName === 'link' &&
        (node.properties.rel as string[] | undefined)?.includes('canonical')
      )
        meta.url = resolveUrl(node.properties.href as string, baseUrl)
    }

    if (Object.keys(meta).length > 0) file.data.meta = meta
  }
}

const strippedTagNames = new Set([
  'aside',
  'footer',
  'form',
  'iframe',
  'nav',
  'noscript',
  'script',
  'style',
  'svg',
])

const strippedRoles = new Set([
  'banner',
  'complementary',
  'contentinfo',
  'navigation',
])

function rehypeStripNoise() {
  return (tree: Root) => {
    strip(tree)
  }
}

function strip(node: Element | Root) {
  if (!node.children) return
  node.children = node.children.filter((child) => {
    if (child.type === 'comment') return false
    if (child.type !== 'element') return true
    if (strippedTagNames.has(child.tagName)) return false
    const role = child.properties?.role as string | undefined
    if (role && strippedRoles.has(role)) return false
    strip(child)
    return true
  })
}

const skipPrefixes = ['http://', 'https://', '//', '#', 'mailto:', 'tel:']

function resolveUrl(url: string, baseUrl?: string): string {
  if (!baseUrl) return url
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

function rehypeResolveLinks(baseUrl?: string) {
  return (tree: Root) => {
    if (!baseUrl) return
    resolveLinks(tree, baseUrl)
  }
}

function resolveLinks(node: Element | Root, baseUrl: string) {
  if (!('children' in node)) return
  node.children = node.children.filter((child) => {
    if (child.type !== 'element') return true
    // Strip anchor elements with hash-only hrefs
    if (child.tagName === 'a') {
      const href = child.properties?.href
      if (typeof href === 'string' && href.startsWith('#')) return false
    }
    for (const prop of ['href', 'src'] as const) {
      const value = child.properties?.[prop]
      if (typeof value !== 'string') continue
      if (skipPrefixes.some((p) => value.startsWith(p))) continue
      try {
        child.properties[prop] = new URL(value, baseUrl).href
      } catch {}
    }
    resolveLinks(child, baseUrl)
    return true
  })
}

// Ensure elements inside <pre> are separated by newlines so
// rehype-remark preserves line breaks in code blocks.
// Also strips trailing <br> inside child elements to avoid
// double newlines (e.g. <div class="cm-line">...<br/></div>).
function rehypePreNewlines() {
  return (tree: Root) => {
    insertPreNewlines(tree)
  }
}

function insertPreNewlines(node: Element | Root) {
  if (!node.children) return
  for (const child of node.children)
    if (child.type === 'element') insertPreNewlines(child)
  if (node.type !== 'element' || node.tagName !== 'pre') return
  stripTrailingBr(node)
  stripInterElementWhitespace(node)
  const updated: typeof node.children = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    updated.push(child)
    if (child.type !== 'element') continue
    const next = node.children[i + 1]
    const alreadyHasNewline =
      next?.type === 'text' && next.value.startsWith('\n')
    if (!alreadyHasNewline) updated.push({ type: 'text', value: '\n' })
  }
  node.children = updated
}

const blockTags = new Set(['div', 'p', 'li', 'tr', 'section', 'article'])

// Strip whitespace-only text nodes between block element siblings inside <pre>.
// HTML formatting newlines between <div>s inside <pre><code> cause extra
// blank lines in the output because rehype-remark treats them as content.
function stripInterElementWhitespace(node: Element | Root) {
  if (!('children' in node)) return
  for (const child of node.children)
    if (child.type === 'element') stripInterElementWhitespace(child)
  node.children = node.children.filter((child, i, arr) => {
    if (child.type !== 'text' || child.value.trim() !== '') return true
    const prev = arr[i - 1]
    const next = arr[i + 1]
    const prevBlock = prev?.type === 'element' && blockTags.has(prev.tagName)
    const nextBlock = next?.type === 'element' && blockTags.has(next.tagName)
    return !(prevBlock || nextBlock)
  })
}

function stripTrailingBr(node: Element | Root) {
  if (!('children' in node)) return
  for (const child of node.children) {
    if (child.type !== 'element') continue
    stripTrailingBr(child)
    const last = child.children[child.children.length - 1]
    if (last?.type === 'element' && last.tagName === 'br') child.children.pop()
  }
}

const emptyStrippableTags = new Set([
  'article',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'main',
  'ol',
  'p',
  'section',
  'span',
  'ul',
])

function rehypeStripEmpty() {
  return (tree: Root) => {
    stripEmpty(tree)
  }
}

function stripEmpty(node: Element | Root) {
  if (!node.children) return
  for (const child of node.children)
    if (child.type === 'element') stripEmpty(child)
  node.children = node.children.filter((child) => {
    if (child.type !== 'element') return true
    if (!emptyStrippableTags.has(child.tagName)) return true
    if (child.children.length === 0) return false
    return !child.children.every(
      (c) => c.type === 'text' && c.value.trim() === '',
    )
  })
}
