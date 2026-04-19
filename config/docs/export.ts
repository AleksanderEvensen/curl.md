import { statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as yaml from 'yaml'
import type { SidebarItem } from '#docs/_sidebar.ts'

const docsDirectoryPath = path.join(process.cwd(), 'docs')
const docsGeneratedManifestPath = path.join(process.cwd(), 'public/docs/.generated-docs.json')
const docsPublicDirectoryPath = path.dirname(docsGeneratedManifestPath)
const sidebarPath = path.join(docsDirectoryPath, '_sidebar.ts')

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

export function generateDocsLlmsFullTxt(props: { docs: Array<DocsStaticFile> }) {
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

export function isDocsSourcePath(filePath: string) {
  return path.resolve(filePath).startsWith(`${docsDirectoryPath}${path.sep}`)
}

export async function syncDocsStaticAssets() {
  const docs = getPublishedDocsStaticFiles(
    await Promise.all(
      (await findDocsMdxFiles(docsDirectoryPath)).map(async (filePath) => ({
        filePath,
        source: await fs.readFile(filePath, 'utf8'),
      })),
    ),
  )
  const sidebar = await (async () => {
    const href = pathToFileURL(sidebarPath).href
    return (await import(`${href}?t=${statSync(sidebarPath).mtimeMs}`))
      .sidebar as Array<SidebarItem>
  })()
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

  // Delete the previous generated files first so renamed docs don't leave stale output behind.
  try {
    const rawManifest = await fs.readFile(docsGeneratedManifestPath, 'utf8')
    const filePaths = JSON.parse(rawManifest) as Array<string>

    for (const filePath of filePaths)
      await fs.rm(path.join(process.cwd(), filePath), { force: true })
  } catch {}

  await fs.rm(docsGeneratedManifestPath, { force: true })

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

function getPublishedDocsStaticFiles(files: Array<{ filePath: string; source: string }>) {
  return files
    .map(({ filePath, source }) => {
      const relativePath = path.relative(docsDirectoryPath, filePath)
      const normalizedPath = relativePath.replace(/\\/g, '/').replace(/\.mdx$/, '')
      const docPath = normalizedPath === 'index' ? '' : normalizedPath.replace(/\/index$/, '')
      const frontmatter = (() => {
        if (!source.startsWith('---\n')) return {}

        const endIndex = source.indexOf('\n---\n', 4)
        if (endIndex === -1) return {}

        try {
          return yaml.parse(source.slice(4, endIndex)) as Record<string, unknown>
        } catch {
          return {}
        }
      })()

      return {
        description:
          typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
        path: docPath,
        source: createDocCopySource(source),
        title:
          (typeof frontmatter.title === 'string' ? frontmatter.title : undefined) ??
          (docPath || 'index'),
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

function createDocCopySource(rawSource: unknown) {
  const lines = stripFrontmatter(getRawDocSource(rawSource)).split('\n')
  const output: Array<string> = []
  let codeFenceMarker: string | undefined

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const fenceMarker = getCodeFenceMarker(line)

    if (fenceMarker) {
      if (!codeFenceMarker) codeFenceMarker = fenceMarker
      else if (isMatchingFenceMarker(fenceMarker, codeFenceMarker)) codeFenceMarker = undefined
      output.push(line)
      continue
    }

    if (codeFenceMarker) {
      output.push(line)
      continue
    }

    if (/^import\s.+$/u.test(line)) continue

    const pluginLinks = rewritePluginLinksComponent(lines, index)
    if (pluginLinks) {
      output.push(...pluginLinks.lines)
      index = pluginLinks.endIndex
      continue
    }

    output.push(line)
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

function getCodeFenceMarker(line: string) {
  return /^(?: {0,3})(`{3,}|~{3,})/u.exec(line)?.[1]
}

function isMatchingFenceMarker(marker: string, other: string) {
  return marker[0] === other[0]
}

function rewritePluginLinksComponent(lines: Array<string>, index: number) {
  const firstLine = lines[index]!
  if (!/^\s*<PluginLinks(?:\s|$)/u.test(firstLine)) return

  const componentLines = [firstLine.trim()]
  let endIndex = index

  if (!/\/?>\s*$/u.test(firstLine)) {
    for (endIndex = index + 1; endIndex < lines.length; endIndex++) {
      const line = lines[endIndex]!
      componentLines.push(line.trim())
      if (/\/?>\s*$/u.test(line)) break
    }

    if (!/\/?>\s*$/u.test(lines[endIndex] ?? '')) return
  }

  const propsMatch = /^<PluginLinks\s+(.+?)\s*\/?>$/u.exec(componentLines.join(' '))
  const props = propsMatch?.[1]
  if (!props) return

  const npm = /(?:^|\s)npm=(['"])(.*?)\1/u.exec(props)?.[2]
  const source = /(?:^|\s)source=(['"])(.*?)\1/u.exec(props)?.[2]
  if (!npm || !source) return

  return {
    endIndex,
    lines: [`- [${npm}](https://www.npmjs.com/package/${npm})`, `- [Source code](${source})`],
  }
}
