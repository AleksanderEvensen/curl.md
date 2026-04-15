import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import mdx from '@mdx-js/rollup'
import json from '@shikijs/langs/json'
import shellscript from '@shikijs/langs/shellscript'
import typescript from '@shikijs/langs/typescript'
import rehypeShikiFromHighlighter, { type RehypeShikiCoreOptions } from '@shikijs/rehype/core'
import githubDarkDefault from '@shikijs/themes/github-dark-default'
import githubLightDefault from '@shikijs/themes/github-light-default'
import type { Root } from 'hast'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import type { Plugin as UnifiedPlugin } from 'unified'
import type * as vite from 'vite'
import * as yaml from 'yaml'
import { createDocCopySource, type Heading } from '../src/routes/docs/-utils.ts'

const highlighter = await createHighlighterCore({
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
  langs: [json, shellscript, typescript],
  themes: [githubDarkDefault, githubLightDefault],
})

export function docs() {
  let isServe = false
  const mdxPlugin = mdx({
    rehypePlugins: [
      rehypeSlug,
      rehypeHeadings(() => isServe),
      rehypePromptShellBlocks,
      [rehypeShikiFromHighlighter, highlighter, shikiOptions],
      rehypeInlineShikiCode,
    ],
    remarkPlugins: [
      remarkFrontmatter,
      remarkDirective,
      remarkGfm,
      remarkDocsDirectives,
      remarkMdxFrontmatter,
    ],
  }) as vite.Plugin

  return {
    ...mdxPlugin,
    async configResolved(this: unknown, config: vite.ResolvedConfig) {
      isServe = config.command === 'serve'
      await syncDocsStaticAssets()
      return (
        (typeof mdxPlugin.configResolved === 'function'
          ? mdxPlugin.configResolved
          : mdxPlugin.configResolved?.handler) as
          | vite.HookHandler<NonNullable<vite.Plugin['configResolved']>>
          | undefined
      )?.call(
        this as ThisParameterType<vite.HookHandler<NonNullable<vite.Plugin['configResolved']>>>,
        config,
      )
    },
    enforce: 'pre' as const,
    async handleHotUpdate(this: unknown, ctx: vite.HmrContext) {
      if (path.resolve(ctx.file).startsWith(`${docsDirectoryPath}${path.sep}`))
        await syncDocsStaticAssets()
      return (
        (typeof mdxPlugin.handleHotUpdate === 'function'
          ? mdxPlugin.handleHotUpdate
          : mdxPlugin.handleHotUpdate?.handler) as
          | vite.HookHandler<NonNullable<vite.Plugin['handleHotUpdate']>>
          | undefined
      )?.call(
        this as ThisParameterType<vite.HookHandler<NonNullable<vite.Plugin['handleHotUpdate']>>>,
        ctx,
      )
    },
    async transform(this: unknown, code: string, id: string) {
      const [filePath, query = ''] = id.split('?', 2)
      const parsedId = filePath?.endsWith('.mdx')
        ? { path: filePath, searchParams: new URLSearchParams(query) }
        : undefined
      if (parsedId?.searchParams.has('raw')) return code
      return (
        (typeof mdxPlugin.transform === 'function'
          ? mdxPlugin.transform
          : mdxPlugin.transform?.handler) as
          | vite.HookHandler<NonNullable<vite.Plugin['transform']>>
          | undefined
      )?.call(
        this as ThisParameterType<vite.HookHandler<NonNullable<vite.Plugin['transform']>>>,
        code,
        id,
      )
    },
  }
}

// --- Internal ---

const shikiOptions = {
  addLanguageClass: true,
  defaultColor: false,
  defaultLanguage: 'text',
  fallbackLanguage: 'text',
  inline: 'tailing-curly-colon',
  parseMetaString(metaString: string) {
    const match = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/u.exec(metaString)
    const hasShellPrompt = /(?:^|\s)shell-prompt(?:\s|$)/u.test(metaString)
    const title = match?.[1] ?? match?.[2] ?? match?.[3]
    if (!hasShellPrompt && !title?.trim()) return undefined
    return {
      ...(hasShellPrompt ? { 'data-shell-prompt': '' } : {}),
      ...(title?.trim() ? { title: title.trim() } : {}),
    }
  },
  themes: {
    dark: 'github-dark-default',
    light: 'github-light-default',
  },
} satisfies RehypeShikiCoreOptions

function rehypeHeadings(shouldUseFileModifiedFallback: () => boolean): UnifiedPlugin<[], Root> {
  return () => (tree, file: any) => {
    const headings: Array<Heading> = []
    const lastUpdated = getLastUpdated(file.path, shouldUseFileModifiedFallback())

    visit(tree, (node: any) => {
      if (node.type === 'element' && /^h[2-4]$/.test(node.tagName) && node.properties?.id) {
        headings.push({
          id: node.properties.id,
          level: Number.parseInt(node.tagName[1]),
          text: nodeToText(node),
        })
      }
    })

    tree.children.push({
      type: 'mdxjsEsm' as any,
      value: '',
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            createExportDeclaration('headings', {
              type: 'ArrayExpression',
              elements: headings.map((h) => ({
                type: 'ObjectExpression',
                properties: [
                  {
                    type: 'Property',
                    kind: 'init',
                    key: { type: 'Identifier', name: 'id' },
                    value: { type: 'Literal', value: h.id },
                    computed: false,
                    method: false,
                    shorthand: false,
                  },
                  {
                    type: 'Property',
                    kind: 'init',
                    key: { type: 'Identifier', name: 'level' },
                    value: { type: 'Literal', value: h.level },
                    computed: false,
                    method: false,
                    shorthand: false,
                  },
                  {
                    type: 'Property',
                    kind: 'init',
                    key: { type: 'Identifier', name: 'text' },
                    value: { type: 'Literal', value: h.text },
                    computed: false,
                    method: false,
                    shorthand: false,
                  },
                ],
              })),
            }),
            createExportDeclaration(
              'lastUpdated',
              lastUpdated === undefined
                ? { type: 'Identifier', name: 'undefined' }
                : { type: 'Literal', value: lastUpdated },
            ),
          ],
        },
      },
    })
  }
}

const lastUpdatedCache = new Map<string, string | undefined>()
const docsDirectoryPath = path.join(process.cwd(), 'docs')
const docsGeneratedManifestPath = path.join(process.cwd(), 'public/docs/.generated-docs.json')
const docsPublicDirectoryPath = path.dirname(docsGeneratedManifestPath)
const sidebarPath = path.join(docsDirectoryPath, '_sidebar.ts')

type SidebarItem =
  | { type: 'link'; label: string; path: string }
  | { type: 'group'; label: string; items: Array<SidebarItem> }
  | { type: 'separator' }

const remarkDocsDirectives: UnifiedPlugin<[], any> = () => (tree, file: any) => {
  if (!Array.isArray(tree.children)) return
  tree.children = transformDocsDirectiveChildren(tree.children, file)
}

function transformDocsDirectiveChildren(children: Array<any>, file: any) {
  return groupAdjacentCardNodes(
    children.flatMap((child) => transformDocsDirectiveNode(child, file)),
  )
}

function transformDocsDirectiveNode(node: any, file: any): Array<any> {
  if (!node || typeof node !== 'object') return [node]

  const legacyNotice = transformLegacyNoticeParagraph(node)
  if (legacyNotice) return [legacyNotice]

  if (node.type === 'containerDirective') return transformContainerDirective(node, file)
  if (node.type === 'leafDirective') return downgradeLeafDirective(node, file)
  if (node.type === 'textDirective') return [downgradeTextDirective(node, file)]

  if (Array.isArray(node.children))
    node.children = transformDocsDirectiveChildren(node.children, file)

  const githubAlert = normalizeGithubAlert(node)
  return githubAlert ? [githubAlert] : [node]
}

function transformContainerDirective(node: any, file: any) {
  const directiveName = typeof node.name === 'string' ? node.name.toLowerCase() : ''
  const { children, label } = splitDirectiveLabel(node)
  const transformedChildren = transformDocsDirectiveChildren(children, file)
  const isClosed = hasClosedDirectiveFence(getNodeSource(node, file))

  if (!isClosed) return downgradeContainerDirective(node, transformedChildren, label, false)

  const noticeType = normalizeNoticeType(directiveName)
  if (noticeType) return [createNoticeNode(noticeType, transformedChildren, label)]
  if (directiveName === 'codegroup')
    return createCodeGroupDirectiveNode(node, transformedChildren, label)
  if (directiveName === 'steps') return createStepsDirectiveNode(node, transformedChildren, label)
  if (directiveName === 'card') return createCardDirectiveNode(node, transformedChildren, label)

  return downgradeContainerDirective(node, transformedChildren, label)
}

function createCodeGroupDirectiveNode(node: any, children: Array<any>, label?: string) {
  const items = children.map((child) => {
    if (child?.type !== 'code') return undefined

    const { label, meta } = splitCodeGroupMeta(child.meta)
    const codeNode = { ...child }
    if (meta) codeNode.meta = meta
    else delete codeNode.meta

    return createMdxFlowElement(
      'CodeGroupItem',
      [codeNode],
      label ? [createMdxJsxAttribute('label', label)] : [],
    )
  })

  if (items.some((item) => item === undefined) || !items[0])
    return downgradeContainerDirective(node, children, label)

  return [createMdxFlowElement('CodeGroup', items as Array<any>)]
}

function createStepsDirectiveNode(node: any, children: Array<any>, label?: string) {
  const items: Array<{ children: Array<any>; title: string }> = []
  let currentItem: { children: Array<any>; title: string } | undefined

  for (const child of children) {
    const title = getStepTitle(child)
    if (title) {
      if (currentItem) items.push(currentItem)
      currentItem = { children: [], title }
      continue
    }

    if (!currentItem) return downgradeContainerDirective(node, children, label)
    currentItem.children.push(child)
  }

  if (currentItem) items.push(currentItem)
  if (!items[0]) return downgradeContainerDirective(node, children, label)

  return [
    createMdxFlowElement(
      'Steps',
      items.map((item) =>
        createMdxFlowElement('Step', item.children, [createMdxJsxAttribute('title', item.title)]),
      ),
    ),
  ]
}

function createCardDirectiveNode(node: any, children: Array<any>, label: string | undefined) {
  const href = getDirectiveAttribute(node.attributes, 'href')
  if (!href || !label) return downgradeContainerDirective(node, children, label)

  const icon = getDirectiveAttribute(node.attributes, 'icon')

  return [
    {
      ...createMdxFlowElement('Card', children, [
        createMdxJsxAttribute('href', href),
        ...(icon ? [createMdxJsxAttribute('icon', icon)] : []),
        createMdxJsxAttribute('title', label),
      ]),
      data: {
        docsDirectiveCard: true,
      },
    },
  ]
}

function splitDirectiveLabel(node: any) {
  const children = [...(node.children ?? [])]
  const firstChild = children[0]
  if (!isDirectiveLabelParagraph(firstChild)) return { children, label: undefined }

  children.shift()
  return {
    children,
    label: nodeToText(firstChild).trim() || undefined,
  }
}

function isDirectiveLabelParagraph(node: any) {
  return node?.type === 'paragraph' && node.data?.directiveLabel === true
}

function getStepTitle(node: any) {
  if (node?.type !== 'heading' || typeof node.depth !== 'number') return undefined
  if (node.depth < 2 || node.depth > 6) return undefined

  const title = nodeToText(node)
    .trim()
    .replace(/[ \t]+#+[ \t]*$/, '')
    .trim()
  return title || undefined
}

function groupAdjacentCardNodes(children: Array<any>) {
  const grouped: Array<any> = []
  let cards: Array<any> = []

  const flushCards = () => {
    if (!cards[0]) return
    grouped.push(createMdxFlowElement('Cards', cards))
    cards = []
  }

  for (const child of children) {
    if (isDocsCardNode(child)) {
      cards.push(child)
      continue
    }

    flushCards()
    grouped.push(child)
  }

  flushCards()
  return grouped
}

function isDocsCardNode(node: any) {
  return (
    node?.type === 'mdxJsxFlowElement' &&
    node.name === 'Card' &&
    node.data?.docsDirectiveCard === true
  )
}

function createMdxFlowElement(name: string, children: Array<any>, attributes: Array<any> = []) {
  return {
    attributes,
    children,
    name,
    type: 'mdxJsxFlowElement',
  }
}

function createMdxJsxAttribute(name: string, value: string) {
  return {
    name,
    type: 'mdxJsxAttribute',
    value,
  }
}

function getDirectiveAttribute(
  attributes: Record<string, string | null | undefined> | null | undefined,
  name: string,
) {
  const value = attributes?.[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function transformLegacyNoticeParagraph(node: any) {
  if (node?.type !== 'paragraph') return

  const match = /^:::\s*([a-z]+)\s+([^\n]+)\n([\s\S]*?)\n:::\s*$/u.exec(nodeToText(node))
  const type = normalizeNoticeType(match?.[1])
  const title = match?.[2]?.trim()
  const body = match?.[3]?.trim()
  if (!type || !title) return

  return createNoticeNode(
    type,
    body ? body.split(/\n{2,}/u).map((value) => createParagraphNode(value)) : [],
    title,
  )
}

function downgradeContainerDirective(
  node: any,
  children: Array<any>,
  label?: string | undefined,
  hasClosingFence = true,
) {
  return [createParagraphNode(serializeDirective(node, ':::', label)), ...children].concat(
    hasClosingFence ? [createParagraphNode(':::')] : [],
  )
}

function downgradeLeafDirective(node: any, file: any) {
  return [
    createParagraphNode(
      getNodeSource(node, file) ??
        serializeDirective(node, '::', nodeToText({ children: node.children ?? [] })),
    ),
  ]
}

function downgradeTextDirective(node: any, file: any) {
  return {
    type: 'text',
    value:
      getNodeSource(node, file) ??
      serializeDirective(node, ':', nodeToText({ children: node.children ?? [] })),
  }
}

function getNodeSource(node: any, file: any) {
  const startOffset = node.position?.start?.offset
  const endOffset = node.position?.end?.offset
  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') return undefined
  return typeof file?.value === 'string' ? file.value.slice(startOffset, endOffset) : undefined
}

function hasClosedDirectiveFence(source: string | undefined) {
  const lines = source?.trimEnd().split('\n')
  return lines?.length ? /^ {0,3}:{3,}\s*$/u.test(lines.at(-1) ?? '') : false
}

function createParagraphNode(value: string) {
  return {
    children: [{ type: 'text', value }],
    type: 'paragraph',
  }
}

function serializeDirective(node: any, prefix: string, label?: string) {
  return `${prefix}${node.name ?? ''}${serializeDirectiveLabel(label)}${serializeDirectiveAttributes(node.attributes)}`
}

function serializeDirectiveLabel(label: string | undefined) {
  const trimmedLabel = label?.trim()
  return trimmedLabel ? `[${trimmedLabel}]` : ''
}

function serializeDirectiveAttributes(
  attributes: Record<string, string | null | undefined> | null | undefined,
) {
  if (!attributes) return ''

  const entries = Object.entries(attributes).filter(([, value]) => value !== undefined)
  if (!entries[0]) return ''

  return `{${entries
    .map(([key, value]) =>
      value === null || value === '' || typeof value !== 'string'
        ? key
        : `${key}=${quoteDirectiveAttribute(value)}`,
    )
    .join(' ')}}`
}

function quoteDirectiveAttribute(value: string) {
  return /^[\w./#:-]+$/u.test(value) ? value : JSON.stringify(value)
}

function splitCodeGroupMeta(meta: string | undefined) {
  const trimmedMeta = meta?.trim() ?? ''
  if (!trimmedMeta) return { label: undefined, meta: undefined }
  if (trimmedMeta.startsWith('[') && trimmedMeta.endsWith(']'))
    return { label: trimmedMeta.slice(1, -1).trim() || undefined, meta: undefined }

  const match = /^(.*?)(?:\s+\[([^\]]+)\])?$/.exec(trimmedMeta)
  return {
    label: match?.[2]?.trim() || undefined,
    meta: match?.[1]?.trim() || undefined,
  }
}
function visit(node: any, fn: (node: any) => void) {
  fn(node)
  if (node.children) for (const child of node.children) visit(child, fn)
}

function nodeToText(node: any): string {
  if (node.type === 'text') return node.value
  if (node.children) return node.children.map(nodeToText).join('')
  return ''
}

function normalizeGithubAlert(node: any) {
  if (node?.type !== 'blockquote' || !node.children?.length) return

  const firstChild = node.children[0]
  if (firstChild?.type !== 'paragraph') return

  const stripped = stripGithubAlertMarker(firstChild)
  if (!stripped) return

  const children = [...(stripped.paragraph ? [stripped.paragraph] : []), ...node.children.slice(1)]

  return createNoticeNode(stripped.type, children)
}

function stripGithubAlertMarker(node: any) {
  const firstChild = node.children?.[0]
  if (firstChild?.type !== 'text') return

  const match = /^\s*\[!([A-Z]+)\]\s*/.exec(firstChild.value)
  if (!match) return

  const type = githubNoticeTypeMap.get(match[1]!.toLowerCase())
  if (!type) return

  const children = [...node.children]
  const nextValue = firstChild.value.slice(match[0].length)
  if (nextValue) children[0] = { ...firstChild, value: nextValue }
  else children.shift()

  return {
    paragraph: hasParagraphContent(children) ? { ...node, children } : undefined,
    type,
  }
}
const githubNoticeTypeMap = new Map([
  ['caution', 'caution'],
  ['important', 'important'],
  ['note', 'note'],
  ['tip', 'tip'],
  ['warning', 'warning'],
])

function hasParagraphContent(children: Array<any>) {
  return children.some((child) => child.type !== 'text' || child.value.trim() !== '')
}

function createNoticeNode(type: string, children: Array<any>, title?: string) {
  return {
    attributes: [
      { type: 'mdxJsxAttribute', name: 'type', value: type },
      ...(title ? [{ type: 'mdxJsxAttribute', name: 'title', value: title }] : []),
    ],
    children,
    name: 'Notice',
    type: 'mdxJsxFlowElement',
  }
}

const shellCodeLanguages = new Set(['bash', 'shell', 'sh', 'zsh'])

const rehypePromptShellBlocks: UnifiedPlugin<[], Root> = () => (tree) => {
  visit(tree, (node: any) => {
    if (node.type !== 'element' || node.tagName !== 'pre') return

    const codeNode = node.children?.find(
      (child: any) => child.type === 'element' && child.tagName === 'code',
    )
    if (!codeNode) return

    const language = getCodeLanguageFromClassName(codeNode.properties?.className)
    if (!language || !shellCodeLanguages.has(language)) return

    const source = nodeToText(codeNode)
    const lines = source.split('\n')
    const nonEmptyLines = lines.filter((line) => line.trim() !== '')
    if (!nonEmptyLines.length || nonEmptyLines.some((line) => !getShellPromptPrefix(line))) return

    codeNode.children = [
      {
        type: 'text',
        value: (() => {
          // Strip the visible shell prompt from each line so copied commands stay runnable.
          return lines
            .map((line) => {
              const prefix = getShellPromptPrefix(line)
              return prefix ? line.slice(prefix.length) : line
            })
            .join('\n')
        })(),
      },
    ]
    codeNode.data = {
      ...codeNode.data,
      meta:
        typeof codeNode.data?.meta !== 'string' || !codeNode.data.meta.trim()
          ? 'shell-prompt'
          : /(?:^|\s)shell-prompt(?:\s|$)/u.test(codeNode.data.meta)
            ? codeNode.data.meta
            : `${codeNode.data.meta} shell-prompt`,
    }
  })
}

const rehypeInlineShikiCode: UnifiedPlugin<[], Root> = () => (tree) => {
  visit(tree, (node: any) => {
    if (node.type !== 'element' || node.tagName !== 'span') return
    if (!hasClassName(node.properties, 'shiki')) return

    const codeNode = node.children?.find(
      (child: any) => child.type === 'element' && child.tagName === 'code',
    )
    if (!codeNode) return

    delete node.properties?.tabindex
    node.properties = {
      ...node.properties,
      'data-shiki-inline-code': '',
    }
    codeNode.properties = {
      ...codeNode.properties,
      'data-shiki-inline-code': '',
    }
  })
}

function getCodeLanguageFromClassName(className: unknown) {
  const value = Array.isArray(className)
    ? className.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof className === 'string'
      ? className
      : ''

  return /\blanguage-([\w-]+)/.exec(value)?.[1]
}

function hasClassName(properties: Record<string, unknown> | undefined, className: string) {
  if (!properties) return false

  const value = [properties.class, properties.className]
    .flatMap((item) =>
      Array.isArray(item)
        ? item.filter((value): value is string => typeof value === 'string')
        : typeof item === 'string'
          ? [item]
          : [],
    )
    .join(' ')

  return new RegExp(`(?:^|\\s)${className}(?:\\s|$)`, 'u').test(value)
}

function getShellPromptPrefix(line: string) {
  const shellPromptPrefixes = ['$ ', '> ', '\u276f ']
  return shellPromptPrefixes.find((prefix) => line.startsWith(prefix))
}

function normalizeNoticeType(type: string | undefined) {
  return type ? noticeTypeMap.get(type.toLowerCase()) : undefined
}
const noticeTypeMap = new Map([
  ['caution', 'caution'],
  ['danger', 'caution'],
  ['hint', 'hint'],
  ['important', 'important'],
  ['note', 'note'],
  ['tip', 'tip'],
  ['warning', 'warning'],
])

function createExportDeclaration(name: string, init: any) {
  return {
    type: 'ExportNamedDeclaration',
    specifiers: [],
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name },
          init,
        },
      ],
    },
  }
}

function getLastUpdated(filePath: string | undefined, useFileModifiedFallback: boolean) {
  if (!filePath) return undefined

  const relativePath = path.relative(process.cwd(), filePath)
  if (!useFileModifiedFallback) {
    const cached = lastUpdatedCache.get(relativePath)
    if (cached !== undefined || lastUpdatedCache.has(relativePath)) return cached
  }

  try {
    const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim()
    const lastUpdated = value || undefined
    if (lastUpdated === undefined && useFileModifiedFallback) return getFileModifiedAt(filePath)
    if (!useFileModifiedFallback) lastUpdatedCache.set(relativePath, lastUpdated)
    return lastUpdated
  } catch {
    if (useFileModifiedFallback) return getFileModifiedAt(filePath)
    lastUpdatedCache.set(relativePath, undefined)
    return undefined
  }
}

async function syncDocsStaticAssets() {
  const docs = await readDocsStaticFiles()
  const sidebar = await getSidebar()
  const docsWithRewrittenLinks = docs.map((doc) => ({
    ...doc,
    source: rewriteGeneratedDocsLinks(doc.source),
  }))
  const docsByPath = new Map(docs.map((doc) => [doc.path, doc]))
  const files = [
    {
      filePath: path.join(docsPublicDirectoryPath, 'llms-full.txt'),
      content: generateDocsLlmsFullTxt({ docs: docsWithRewrittenLinks }),
    },
    {
      filePath: path.join(docsPublicDirectoryPath, 'llms.txt'),
      content: generateDocsLlmsTxt({ sections: getDocsLlmsSections(docsByPath, sidebar) }),
    },
    ...docsWithRewrittenLinks.map((doc) => ({
      filePath: path.join(docsPublicDirectoryPath, doc.path ? `${doc.path}.md` : 'index.md'),
      content: `${doc.source}\n`,
    })),
  ]

  await removeGeneratedDocsStaticAssets()

  for (const file of files) {
    await fs.mkdir(path.dirname(file.filePath), { recursive: true })
    await fs.writeFile(file.filePath, file.content)
  }

  await fs.writeFile(
    docsGeneratedManifestPath,
    JSON.stringify(
      files.map((file) => path.relative(process.cwd(), file.filePath)).sort(),
      null,
      2,
    ),
  )
}

type DocsLlmsSection = {
  docs: Array<{ description: string | undefined; path: string; title: string }>
  title: string
}

type DocsStaticFile = {
  description: string | undefined
  path: string
  source: string
  title: string
}

export function rewriteGeneratedDocsLinks(source: string) {
  return source.replace(
    /\]\((\/docs(?:\/[^)#?]*)?)(\?[^)#]*)?(#[^)]+)?\)/g,
    (_match, pathname, search, hash) => {
      if (pathname === '/docs') return `](/docs/index.md${search ?? ''}${hash ?? ''})`
      if (pathname.endsWith('.md')) return `](${pathname}${search ?? ''}${hash ?? ''})`
      return `](${pathname}.md${search ?? ''}${hash ?? ''})`
    },
  )
}

export function generateDocsLlmsTxt(props: { sections: Array<DocsLlmsSection> }) {
  const { sections } = props
  const lines = [
    '# curl.md Docs',
    '',
    '> Canonical curl.md documentation for installation, usage, and development.',
    '',
    'Use these pages when you need the current published docs. The links below follow the docs navigation order.',
  ]

  for (const section of sections) {
    lines.push('', `## ${section.title}`, '')

    for (const doc of section.docs)
      lines.push(
        `- [${doc.title}](${doc.path ? `/docs/${doc.path}.md` : '/docs/index.md'}): ${doc.description ?? doc.title}`,
      )
  }

  return `${lines.join('\n')}\n`
}

export function generateDocsLlmsFullTxt(props: {
  docs: Array<{
    description: string | undefined
    path: string
    source: string
    title: string
  }>
}) {
  const { docs } = props
  const lines = [
    '# curl.md Docs Full',
    '',
    '> Full markdown export of the canonical curl.md documentation.',
    '',
    'Use this file when you want the entire docs set in a single markdown document.',
  ]

  for (const doc of docs) {
    lines.push('', `## ${doc.path ? `/docs/${doc.path}.md` : '/docs/index.md'}`, '')

    if (doc.description) lines.push(doc.description, '')

    lines.push(doc.source)
  }

  return `${lines.join('\n')}\n`
}

async function removeGeneratedDocsStaticAssets() {
  try {
    const rawManifest = await fs.readFile(docsGeneratedManifestPath, 'utf8')
    const filePaths = JSON.parse(rawManifest) as Array<string>

    for (const filePath of filePaths)
      await fs.rm(path.join(process.cwd(), filePath), { force: true })
  } catch {}

  await fs.rm(docsGeneratedManifestPath, { force: true })
}

async function readDocsStaticFiles() {
  const filePaths = await findDocsMdxFiles(docsDirectoryPath)
  return getPublishedDocsStaticFiles(
    await Promise.all(
      filePaths.map(async (filePath) => ({
        filePath,
        source: await fs.readFile(filePath, 'utf8'),
      })),
    ),
  )
}

export function getPublishedDocsStaticFiles(files: Array<{ filePath: string; source: string }>) {
  return files
    .map(({ filePath, source }) => {
      const relativePath = path.relative(docsDirectoryPath, filePath)
      const normalizedPath = relativePath.replace(/\\/g, '/').replace(/\.mdx$/, '')
      const docPath = normalizedPath === 'index' ? '' : normalizedPath.replace(/\/index$/, '')
      const frontmatter = parseDocsFrontmatter(source)

      return {
        description: getFrontmatterString(frontmatter, 'description'),
        path: docPath,
        source: createDocCopySource(source),
        title: getFrontmatterString(frontmatter, 'title') ?? (docPath || 'index'),
      } satisfies DocsStaticFile
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

async function findDocsMdxFiles(directoryPath: string): Promise<Array<string>> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const filePaths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) return findDocsMdxFiles(entryPath)
      if (entry.isFile() && entry.name.endsWith('.mdx')) return [entryPath]
      return []
    }),
  )

  return filePaths.flat()
}

function parseDocsFrontmatter(source: string) {
  if (!source.startsWith('---\n')) return {}

  const endIndex = source.indexOf('\n---\n', 4)
  if (endIndex === -1) return {}

  try {
    return yaml.parse(source.slice(4, endIndex)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function getFrontmatterString(frontmatter: Record<string, unknown>, key: string) {
  const value = frontmatter[key]
  return typeof value === 'string' ? value : undefined
}

export function getDocsLlmsSections(
  docsByPath: Map<string, { description: string | undefined; path: string; title: string }>,
  sidebarItems: Array<SidebarItem>,
) {
  const overviewDocs: Array<DocsLlmsSection['docs'][number]> = []
  const sections: Array<DocsLlmsSection> = []

  for (const item of sidebarItems) {
    if (item.type === 'link') {
      const doc = docsByPath.get(normalizeSidebarPath(item.path))
      if (doc) overviewDocs.push(doc)
      continue
    }

    if (item.type === 'separator') continue

    const docs = collectSidebarDocs(item.items, docsByPath)
    if (docs.length === 0) continue
    sections.push({ docs, title: item.label })
  }

  if (overviewDocs.length > 0) sections.unshift({ docs: overviewDocs, title: 'Overview' })
  return sections
}

async function getSidebar() {
  const href = pathToFileURL(sidebarPath).href
  const module = await import(`${href}?t=${statSync(sidebarPath).mtimeMs}`)
  return module.sidebar
}

function collectSidebarDocs(
  items: Array<SidebarItem>,
  docsByPath: Map<string, { description: string | undefined; path: string; title: string }>,
) {
  const docs: Array<DocsLlmsSection['docs'][number]> = []

  for (const item of items) {
    if (item.type === 'link') {
      const doc = docsByPath.get(normalizeSidebarPath(item.path))
      if (doc) docs.push(doc)
      continue
    }

    if (item.type === 'separator') continue

    docs.push(...collectSidebarDocs(item.items, docsByPath))
  }

  return docs
}

function normalizeSidebarPath(pathname: string) {
  if (pathname === '/') return ''
  return pathname.replace(/^\//, '')
}

function getFileModifiedAt(filePath: string) {
  try {
    return statSync(filePath).mtime.toISOString()
  } catch {
    return undefined
  }
}
