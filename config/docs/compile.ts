import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import path from 'node:path'
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

type Heading = { id: string; level: number; text: string }

const noticeTypeMap = new Map<
  string,
  'caution' | 'hint' | 'important' | 'note' | 'tip' | 'warning'
>([
  ['caution', 'caution'],
  ['danger', 'caution'],
  ['hint', 'hint'],
  ['important', 'important'],
  ['note', 'note'],
  ['tip', 'tip'],
  ['warning', 'warning'],
])

const highlighter = await createHighlighterCore({
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
  langs: [json, shellscript, typescript],
  themes: [githubDarkDefault, githubLightDefault],
})

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

export function docsCompile() {
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

const rehypeInlineShikiCode: UnifiedPlugin<[], Root> = () => (tree) => {
  visit(tree, (node: any) => {
    if (node.type !== 'element' || node.tagName !== 'span') return
    if (
      !(() => {
        const value = [node.properties?.class, node.properties?.className]
          .flatMap((item) =>
            Array.isArray(item)
              ? item.filter((value: unknown): value is string => typeof value === 'string')
              : typeof item === 'string'
                ? [item]
                : [],
          )
          .join(' ')

        // HAST may store classes in either `class` or `className`, as strings or arrays.
        return /(?:^|\s)shiki(?:\s|$)/u.test(value)
      })()
    )
      return

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

const rehypePromptShellBlocks: UnifiedPlugin<[], Root> = () => (tree) => {
  const shellPromptPrefixes = ['$ ', '> ', '\u276f ']

  visit(tree, (node: any) => {
    if (node.type !== 'element' || node.tagName !== 'pre') return

    const codeNode = node.children?.find(
      (child: any) => child.type === 'element' && child.tagName === 'code',
    )
    if (!codeNode) return

    const language = (() => {
      const value = Array.isArray(codeNode.properties?.className)
        ? codeNode.properties.className
            .filter((item: unknown): item is string => typeof item === 'string')
            .join(' ')
        : typeof codeNode.properties?.className === 'string'
          ? codeNode.properties.className
          : ''

      // Shiki stores code block languages in `language-*` class names.
      return /\blanguage-([\w-]+)/.exec(value)?.[1]
    })()
    if (!language || !shellCodeLanguages.has(language)) return

    const source = nodeToText(codeNode)
    const lines = source.split('\n')
    const nonEmptyLines = lines.filter((line) => line.trim() !== '')
    if (
      !nonEmptyLines.length ||
      nonEmptyLines.some((line) => !shellPromptPrefixes.find((prefix) => line.startsWith(prefix)))
    )
      return

    codeNode.children = [
      {
        type: 'text',
        value: (() => {
          // Strip the visible shell prompt from each line so copied commands stay runnable.
          return lines
            .map((line) => {
              const prefix = shellPromptPrefixes.find((prefix) => line.startsWith(prefix))
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

const remarkDocsDirectives: UnifiedPlugin<[], any> = () => (tree, file: any) => {
  if (!Array.isArray(tree.children)) return
  tree.children = transformDocsDirectiveChildren(tree.children, file)
}

function rehypeHeadings(shouldUseFileModifiedFallback: () => boolean): UnifiedPlugin<[], Root> {
  return () => (tree, file: any) => {
    const renderedHeadings: Array<Heading> = []
    const lastUpdated = (() => {
      if (!file.path) return undefined

      const useFileModifiedFallback = shouldUseFileModifiedFallback()
      const relativePath = path.relative(process.cwd(), file.path)
      if (!useFileModifiedFallback) {
        const cached = lastUpdatedCache.get(relativePath)
        if (cached !== undefined || lastUpdatedCache.has(relativePath)) return cached
      }

      try {
        // Prefer the last git commit timestamp; fall back to file mtime during dev when history is unavailable.
        const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
          cwd: process.cwd(),
          encoding: 'utf8',
        }).trim()
        const lastUpdated = value || undefined
        if (lastUpdated === undefined && useFileModifiedFallback)
          return (() => {
            try {
              return statSync(file.path).mtime.toISOString()
            } catch {
              return undefined
            }
          })()
        if (!useFileModifiedFallback) lastUpdatedCache.set(relativePath, lastUpdated)
        return lastUpdated
      } catch {
        if (useFileModifiedFallback)
          return (() => {
            try {
              return statSync(file.path).mtime.toISOString()
            } catch {
              return undefined
            }
          })()
        lastUpdatedCache.set(relativePath, undefined)
        return undefined
      }
    })()

    visit(tree, (node: any) => {
      if (node.type === 'element' && /^h[2-4]$/.test(node.tagName) && node.properties?.id) {
        renderedHeadings.push({
          id: node.properties.id,
          level: Number.parseInt(node.tagName[1]),
          text: nodeToText(node),
        })
      }
    })

    const headings = getDocHeadings(file.value, renderedHeadings)

    tree.children.push({
      type: 'mdxjsEsm' as any,
      value: '',
      data: {
        estree: {
          type: 'Program',
          sourceType: 'module',
          body: [
            {
              type: 'ExportNamedDeclaration',
              specifiers: [],
              declaration: {
                type: 'VariableDeclaration',
                kind: 'const',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: { type: 'Identifier', name: 'headings' },
                    init: {
                      type: 'ArrayExpression',
                      elements: headings.map((heading) => ({
                        type: 'ObjectExpression',
                        properties: [
                          {
                            type: 'Property',
                            kind: 'init',
                            key: { type: 'Identifier', name: 'id' },
                            value: { type: 'Literal', value: heading.id },
                            computed: false,
                            method: false,
                            shorthand: false,
                          },
                          {
                            type: 'Property',
                            kind: 'init',
                            key: { type: 'Identifier', name: 'level' },
                            value: { type: 'Literal', value: heading.level },
                            computed: false,
                            method: false,
                            shorthand: false,
                          },
                          {
                            type: 'Property',
                            kind: 'init',
                            key: { type: 'Identifier', name: 'text' },
                            value: { type: 'Literal', value: heading.text },
                            computed: false,
                            method: false,
                            shorthand: false,
                          },
                        ],
                      })),
                    },
                  },
                ],
              },
            },
            {
              type: 'ExportNamedDeclaration',
              specifiers: [],
              declaration: {
                type: 'VariableDeclaration',
                kind: 'const',
                declarations: [
                  {
                    type: 'VariableDeclarator',
                    id: { type: 'Identifier', name: 'lastUpdated' },
                    init:
                      lastUpdated === undefined
                        ? { type: 'Identifier', name: 'undefined' }
                        : { type: 'Literal', value: lastUpdated },
                  },
                ],
              },
            },
          ],
        },
      },
    })
  }
}

function transformDocsDirectiveChildren(children: Array<any>, file: any) {
  return groupAdjacentCardNodes(
    children.flatMap((child) => transformDocsDirectiveNode(child, file)),
  )
}

function transformDocsDirectiveNode(node: any, file: any): Array<any> {
  if (!node || typeof node !== 'object') return [node]

  if (node.type === 'containerDirective') return transformContainerDirective(node, file)
  if (node.type === 'leafDirective')
    return [
      {
        children: [
          {
            type: 'text',
            value:
              getNodeSource(node, file) ??
              serializeDirective(node, '::', nodeToText({ children: node.children ?? [] })),
          },
        ],
        type: 'paragraph',
      },
    ]
  if (node.type === 'textDirective')
    return [
      {
        type: 'text',
        value:
          getNodeSource(node, file) ??
          serializeDirective(node, ':', nodeToText({ children: node.children ?? [] })),
      },
    ]

  if (Array.isArray(node.children))
    node.children = transformDocsDirectiveChildren(node.children, file)

  return [node]
}

function transformContainerDirective(node: any, file: any) {
  const directiveName = typeof node.name === 'string' ? node.name.toLowerCase() : ''
  const { children, label } = (() => {
    const children = [...(node.children ?? [])]
    const firstChild = children[0]
    // remark-directive stores directive labels as a leading paragraph child.
    if (!(firstChild?.type === 'paragraph' && firstChild.data?.directiveLabel === true))
      return { children, label: undefined }

    children.shift()
    return {
      children,
      label: nodeToText(firstChild).trim() || undefined,
    }
  })()
  const transformedChildren = transformDocsDirectiveChildren(children, file)
  const isClosed = (() => {
    const lines = getNodeSource(node, file)?.trimEnd().split('\n')
    // Treat the directive as closed only when its source ends with a standalone ::: fence.
    return lines?.length ? /^ {0,3}:{3,}\s*$/u.test(lines.at(-1) ?? '') : false
  })()

  if (!isClosed) return downgradeContainerDirective(node, transformedChildren, label, false)

  const noticeType = noticeTypeMap.get(directiveName)
  if (noticeType)
    return [
      {
        attributes: [
          { type: 'mdxJsxAttribute', name: 'type', value: noticeType },
          ...(label ? [{ type: 'mdxJsxAttribute', name: 'title', value: label }] : []),
        ],
        children: transformedChildren,
        name: 'Notice',
        type: 'mdxJsxFlowElement',
      },
    ]
  if (directiveName === 'codegroup')
    return createCodeGroupDirectiveNode(node, transformedChildren, label)
  if (directiveName === 'steps') return createStepsDirectiveNode(node, transformedChildren, label)
  if (directiveName === 'card') return createCardDirectiveNode(node, transformedChildren, label)

  return downgradeContainerDirective(node, transformedChildren, label)
}

function createCodeGroupDirectiveNode(node: any, children: Array<any>, label?: string) {
  const items = children.map((child) => {
    if (child?.type !== 'code') return undefined

    const { label, meta } = (() => {
      const trimmedMeta = child.meta?.trim() ?? ''
      if (!trimmedMeta) return { label: undefined, meta: undefined }

      // Code group fences may be `[label]` only or `meta [label]`; split them before rewriting.
      if (trimmedMeta.startsWith('[') && trimmedMeta.endsWith(']'))
        return { label: trimmedMeta.slice(1, -1).trim() || undefined, meta: undefined }

      const match = /^(.*?)(?:\s+\[([^\]]+)\])?$/.exec(trimmedMeta)
      return {
        label: match?.[2]?.trim() || undefined,
        meta: match?.[1]?.trim() || undefined,
      }
    })()
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
    const title = (() => {
      if (child?.type !== 'heading' || typeof child.depth !== 'number') return undefined
      if (child.depth < 2 || child.depth > 6) return undefined

      // Step items start at a markdown heading; strip any trailing ATX fence markers.
      const title = nodeToText(child)
        .trim()
        .replace(/[ \t]+#+[ \t]*$/, '')
        .trim()
      return title || undefined
    })()
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
  const href = (() => {
    const value = node.attributes?.href
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  })()
  if (!href || !label) return downgradeContainerDirective(node, children, label)

  const icon = (() => {
    const value = node.attributes?.icon
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  })()

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

function groupAdjacentCardNodes(children: Array<any>) {
  const grouped: Array<any> = []
  let cards: Array<any> = []

  const flushCards = () => {
    if (!cards[0]) return
    grouped.push(createMdxFlowElement('Cards', cards))
    cards = []
  }

  for (const child of children) {
    if (
      child?.type === 'mdxJsxFlowElement' &&
      child.name === 'Card' &&
      child.data?.docsDirectiveCard === true
    ) {
      cards.push(child)
      continue
    }

    flushCards()
    grouped.push(child)
  }

  flushCards()
  return grouped
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

function downgradeContainerDirective(
  node: any,
  children: Array<any>,
  label?: string | undefined,
  hasClosingFence = true,
) {
  return [
    {
      children: [{ type: 'text', value: serializeDirective(node, ':::', label) }],
      type: 'paragraph',
    },
    ...children,
  ].concat(
    hasClosingFence
      ? [
          {
            children: [{ type: 'text', value: ':::' }],
            type: 'paragraph',
          },
        ]
      : [],
  )
}

function getNodeSource(node: any, file: any) {
  const startOffset = node.position?.start?.offset
  const endOffset = node.position?.end?.offset
  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') return undefined
  return typeof file?.value === 'string' ? file.value.slice(startOffset, endOffset) : undefined
}

function serializeDirective(node: any, prefix: string, label?: string) {
  return `${prefix}${node.name ?? ''}${(() => {
    const trimmedLabel = label?.trim()
    // Directive labels serialize as `[label]` immediately after the directive name.
    return trimmedLabel ? `[${trimmedLabel}]` : ''
  })()}${(() => {
    if (!node.attributes) return ''

    const entries = Object.entries(node.attributes).filter(([, value]) => value !== undefined)
    if (!entries[0]) return ''

    // Serialize mdast directive attributes back into `{key=value}` syntax when downgrading.
    return `{${entries
      .map(([key, value]) =>
        value === null || value === '' || typeof value !== 'string'
          ? key
          : `${key}=${(() => {
              // Keep simple attribute values bare; quote anything that needs escaping.
              return /^[\w./#:-]+$/u.test(value) ? value : JSON.stringify(value)
            })()}`,
      )
      .join(' ')}}`
  })()}`
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

const lastUpdatedCache = new Map<string, string | undefined>()

const shellCodeLanguages = new Set(['bash', 'shell', 'sh', 'zsh'])

function getDocHeadings(rawSource: unknown, renderedHeadings: Array<Heading>) {
  const sourceOutline = getSourceOutline(rawSource)
  const stepHeadingIds = new Set(
    sourceOutline
      .filter((entry): entry is { heading: Heading; type: 'step' } => entry.type === 'step')
      .map((entry) => entry.heading.id),
  )
  const normalizedRenderedHeadings = renderedHeadings.filter(
    (heading) => !stepHeadingIds.has(heading.id),
  )
  const renderedHeadingCount = sourceOutline.filter((entry) => entry.type === 'rendered').length
  if (renderedHeadingCount !== normalizedRenderedHeadings.length)
    return dedupeHeadingsById(renderedHeadings)

  const headings: Array<Heading> = []
  let renderedHeadingIndex = 0

  for (const entry of sourceOutline) {
    if (entry.type === 'rendered') {
      const heading = normalizedRenderedHeadings[renderedHeadingIndex]
      if (heading) headings.push(heading)
      renderedHeadingIndex++
      continue
    }

    headings.push(entry.heading)
  }

  return dedupeHeadingsById(headings)
}

function getRawDocSource(rawSource: unknown) {
  if (typeof rawSource === 'string') return rawSource
  if (
    rawSource &&
    typeof rawSource === 'object' &&
    'default' in rawSource &&
    typeof rawSource.default === 'string'
  )
    return rawSource.default
  return ''
}

function stripFrontmatter(markdown: string) {
  if (!markdown.startsWith('---\n')) return markdown
  const end = markdown.indexOf('\n---\n', 4)
  if (end === -1) return markdown
  return markdown.slice(end + 5).replace(/^\n+/, '')
}

function parseContainerDirective(line: string) {
  const match = /^(?: {0,3})(:{3,})([a-z][\w-]*)(?:(?=[\s[{]|$)(.*))?$/iu.exec(line)
  if (!match?.[1] || !match[2]) return

  return {
    marker: match[1],
    name: match[2],
    rest: match[3]?.trim() || undefined,
  }
}

function getContainerDirective(line: string, name: string) {
  const directive = parseContainerDirective(line)
  if (!directive || directive.name.toLowerCase() !== name.toLowerCase()) return
  return directive
}

function collectDirectiveBody(lines: Array<string>, index: number) {
  const directive = parseContainerDirective(lines[index]!)
  if (!directive) return

  const body: Array<string> = []
  let codeFenceMarker: string | undefined
  const directiveMarkers = [directive.marker]

  for (let endIndex = index + 1; endIndex < lines.length; endIndex++) {
    const line = lines[endIndex]!
    const fenceMarker = getCodeFenceMarker(line)

    if (fenceMarker) {
      if (!codeFenceMarker) codeFenceMarker = fenceMarker
      else if (isMatchingFenceMarker(fenceMarker, codeFenceMarker)) codeFenceMarker = undefined
      body.push(line)
      continue
    }

    const nestedDirective = parseContainerDirective(line)
    if (nestedDirective) {
      directiveMarkers.push(nestedDirective.marker)
      body.push(line)
      continue
    }

    const closingDirectiveMarker = /^(?: {0,3})(:{3,})\s*$/u.exec(line)?.[1]
    if (closingDirectiveMarker) {
      const currentDirectiveMarker = directiveMarkers.at(-1)
      if (
        currentDirectiveMarker &&
        closingDirectiveMarker.length >= currentDirectiveMarker.length
      ) {
        directiveMarkers.pop()
        if (!directiveMarkers.length) return { body, endIndex }
      }

      body.push(line)
      continue
    }

    body.push(line)
  }
}

function parseMarkdownHeading(line: string, options?: { maxLevel?: number; minLevel?: number }) {
  const match = /^(?: {0,3})(#{1,6})[ \t]+(.+?)\s*$/u.exec(line)
  if (!match?.[1] || !match[2]) return

  const level = match[1].length
  if (options?.minLevel !== undefined && level < options.minLevel) return
  if (options?.maxLevel !== undefined && level > options.maxLevel) return

  const text = match[2].replace(/[ \t]+#+[ \t]*$/, '').trim()
  return text ? { level, text } : undefined
}

function getCodeFenceMarker(line: string) {
  return /^(?: {0,3})(`{3,}|~{3,})/u.exec(line)?.[1]
}

function isMatchingFenceMarker(marker: string, other: string) {
  return marker[0] === other[0]
}

function getSourceOutline(rawSource: unknown) {
  const lines = stripFrontmatter(getRawDocSource(rawSource)).split('\n')
  const outline: Array<{ type: 'rendered' } | { heading: Heading; type: 'step' }> = []
  let codeFenceMarker: string | undefined

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const fenceMarker = getCodeFenceMarker(line)

    if (fenceMarker) {
      if (!codeFenceMarker) codeFenceMarker = fenceMarker
      else if (isMatchingFenceMarker(fenceMarker, codeFenceMarker)) codeFenceMarker = undefined
      continue
    }

    if (codeFenceMarker) continue

    const stepHeadings = getStepHeadings(lines, index)
    if (stepHeadings) {
      outline.push(...stepHeadings)
      const body = collectDirectiveBody(lines, index)
      if (body) index = body.endIndex
      continue
    }

    if (parseMarkdownHeading(line, { maxLevel: 4, minLevel: 2 })) outline.push({ type: 'rendered' })
  }

  return outline
}

function getStepHeadings(lines: Array<string>, index: number) {
  if (!getContainerDirective(lines[index]!, 'steps')) return

  const body = collectDirectiveBody(lines, index)
  if (!body) return []

  const stepSlugCounts = new Map<string, number>()
  const headings: Array<{ heading: Heading; type: 'step' }> = []
  let codeFenceMarker: string | undefined
  let stepNumber = 1

  for (const line of body.body) {
    const fenceMarker = getCodeFenceMarker(line)

    if (fenceMarker) {
      if (!codeFenceMarker) codeFenceMarker = fenceMarker
      else if (isMatchingFenceMarker(fenceMarker, codeFenceMarker)) codeFenceMarker = undefined
      continue
    }

    if (codeFenceMarker) continue

    const heading = parseMarkdownHeading(line, { maxLevel: 6, minLevel: 2 })
    if (!heading) continue

    headings.push({
      heading: {
        id: getStepId(heading.text, stepSlugCounts),
        level: 3,
        text: `${stepNumber}. ${heading.text}`,
      },
      type: 'step',
    })
    stepNumber++
  }

  return headings
}

function getStepId(title: string, stepSlugCounts: Map<string, number>) {
  const baseSlug = slugifyHeading(title) || 'step'
  const count = stepSlugCounts.get(baseSlug) ?? 0
  stepSlugCounts.set(baseSlug, count + 1)
  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
}

function slugifyHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`'".(),/#!?]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function dedupeHeadingsById(headings: Array<Heading>) {
  const seenIds = new Set<string>()
  return headings.filter((heading) => {
    if (seenIds.has(heading.id)) return false
    seenIds.add(heading.id)
    return true
  })
}
