import type { Element, Root } from 'hast'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import type { VFile } from 'vfile'

export async function htmlToMarkdown(
  html: string,
  options?: { baseUrl?: string },
): Promise<string> {
  const file = await unified()
    .use(rehypeParse)
    .use(rehypeExtractMeta)
    .use(rehypeStripNoise)
    .use(rehypeResolveLinks, options?.baseUrl)
    .use(rehypeStripEmpty)
    .use(rehypeRemark)
    .use(remarkStringify)
    .process(html)
  const meta = file.data.meta as Record<string, string> | undefined
  const frontmatter = meta
    ? Object.entries(meta)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('\n')
    : undefined
  return frontmatter
    ? `---\n${frontmatter}\n---\n\n${String(file)}`
    : String(file)
}

const metaPropertyMap: Record<string, string> = {
  author: 'author',
  description: 'description',
  'og:description': 'description',
  'og:site_name': 'site',
}

function rehypeExtractMeta() {
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
        meta.url = node.properties.href as string
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

function rehypeResolveLinks(baseUrl?: string) {
  return (tree: Root) => {
    if (!baseUrl) return
    resolveLinks(tree, baseUrl)
  }
}

function resolveLinks(node: Element | Root, baseUrl: string) {
  if (!('children' in node)) return
  for (const child of node.children) {
    if (child.type !== 'element') continue
    for (const prop of ['href', 'src'] as const) {
      const value = child.properties?.[prop]
      if (typeof value !== 'string') continue
      if (skipPrefixes.some((p) => value.startsWith(p))) continue
      try {
        child.properties[prop] = new URL(value, baseUrl).href
      } catch {}
    }
    resolveLinks(child, baseUrl)
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
