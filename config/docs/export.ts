import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as yaml from 'yaml'
import { createDocCopySource, type SidebarItem } from '#lib/docs.ts'

const docsDirectoryPath = path.join(process.cwd(), 'docs')
const docsGeneratedManifestPath = path.join(process.cwd(), 'public/docs/.generated-docs.json')
const docsPublicDirectoryPath = path.dirname(docsGeneratedManifestPath)
const sitemapPath = path.join(process.cwd(), 'public/sitemap.xml')
const sidebarPath = path.join(docsDirectoryPath, '_sidebar.ts')
const llmsExcludedDocPaths = new Set(['privacy', 'terms'])
const llmsFullExcludedDocPaths = new Set([...llmsExcludedDocPaths, 'brand', 'dev/kitchen-sink'])

type DocsLlmsSection = {
  docs: Array<{ description: string | undefined; path: string; title: string }>
  title: string
}

type DocsStaticFile = {
  description: string | undefined
  lastUpdated?: string
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

    lines.push(demoteMarkdownHeadings(doc.source))
  }

  return `${lines.join('\n')}\n`
}

export function generateSitemapXml(props: {
  docs: Array<Pick<DocsStaticFile, 'lastUpdated' | 'path'>>
}) {
  const docsIndex = props.docs.find((doc) => doc.path === '')
  const urls = [
    { loc: 'https://curl.md/' },
    { lastUpdated: docsIndex?.lastUpdated, loc: 'https://curl.md/docs' },
    { loc: 'https://curl.md/playground' },
    ...props.docs
      .filter((doc) => doc.path)
      .map((doc) => ({ lastUpdated: doc.lastUpdated, loc: `https://curl.md/docs/${doc.path}` })),
  ]

  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => {
      const lines = ['  <url>', `    <loc>${escapeXml(url.loc)}</loc>`]
      if (url.lastUpdated) lines.push(`    <lastmod>${escapeXml(url.lastUpdated)}</lastmod>`)
      lines.push('  </url>')
      return lines.join('\n')
    }),
    '</urlset>',
  ].join('\n')}\n`
}

export function getDocsInSidebarOrder<
  obj extends { description: string | undefined; path: string; title: string },
>(docsByPath: Map<string, obj>, sidebarItems: Array<SidebarItem>) {
  const docs: Array<obj> = []
  const seenPaths = new Set<string>()

  for (const doc of [docsByPath.get(''), ...collectSidebarDocs(sidebarItems, docsByPath)]) {
    if (!doc || seenPaths.has(doc.path)) continue
    docs.push(doc)
    seenPaths.add(doc.path)
  }

  for (const doc of docsByPath.values()) {
    if (seenPaths.has(doc.path)) continue
    docs.push(doc)
  }

  return docs
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

    if (item.type === 'href' || item.type === 'separator') continue

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
  const llmsDocs = docsWithRewrittenLinks.filter((doc) => !llmsExcludedDocPaths.has(doc.path))
  const llmsFullDocs = docsWithRewrittenLinks.filter(
    (doc) => !llmsFullExcludedDocPaths.has(doc.path),
  )
  const docsByPath = new Map(llmsDocs.map((doc) => [doc.path, doc]))
  const llmsFullDocsByPath = new Map(llmsFullDocs.map((doc) => [doc.path, doc]))
  const files = [
    {
      filePath: path.join(docsPublicDirectoryPath, 'llms-full.txt'),
      content: generateDocsLlmsFullTxt({
        docs: getDocsInSidebarOrder(llmsFullDocsByPath, sidebar),
      }),
    },
    {
      filePath: path.join(docsPublicDirectoryPath, 'llms.txt'),
      content: generateDocsLlmsTxt({ sections: getDocsLlmsSections(docsByPath, sidebar) }),
    },
    {
      filePath: sitemapPath,
      content: generateSitemapXml({
        docs: getDocsInSidebarOrder(new Map(docs.map((doc) => [doc.path, doc])), sidebar),
      }),
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
        lastUpdated: getLastUpdated(filePath),
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

function collectSidebarDocs<
  obj extends { description: string | undefined; path: string; title: string },
>(items: Array<SidebarItem>, docsByPath: Map<string, obj>) {
  const docs: Array<obj> = []

  for (const item of items) {
    if (item.type === 'link') {
      const doc = docsByPath.get(normalizeSidebarPath(item.path))
      if (doc) docs.push(doc)
      continue
    }

    if (item.type === 'href' || item.type === 'separator') continue

    docs.push(...collectSidebarDocs(item.items, docsByPath))
  }

  return docs
}

function normalizeSidebarPath(pathname: string) {
  if (pathname === '/') return ''
  return pathname.replace(/^\//, '')
}

function demoteMarkdownHeadings(source: string) {
  let fence: { char: string; length: number } | null = null

  return source
    .split('\n')
    .map((line) => {
      const fenceMatch = /^( {0,3})([`~]{3,})/.exec(line)
      if (fenceMatch) {
        const marker = fenceMatch[2] ?? ''
        const char = marker.slice(0, 1)
        if (!fence) fence = { char, length: marker.length }
        else if (char === fence.char && marker.length >= fence.length) fence = null
        return line
      }

      if (fence) return line
      return line.replace(/^(#{1,6})(?=\s)/, (hashes) => '#'.repeat(Math.min(hashes.length + 2, 6)))
    })
    .join('\n')
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getLastUpdated(filePath: string) {
  const relativePath = path.relative(process.cwd(), filePath)
  try {
    const value = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim()
    return value || statSync(filePath).mtime.toISOString()
  } catch {
    return statSync(filePath).mtime.toISOString()
  }
}
