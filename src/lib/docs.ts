export type Heading = { id: string; level: number; text: string }

export type { SidebarItem } from '#docs/_sidebar.ts'

export const noticeTypeMap = new Map<
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

const docSearchHighlightStopwords = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

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

export function parseMarkdownHeading(
  line: string,
  options?: { maxLevel?: number; minLevel?: number },
) {
  const match = /^(?: {0,3})(#{1,6})[ \t]+(.+?)\s*$/u.exec(line)
  if (!match?.[1] || !match[2]) return

  const level = match[1].length
  if (options?.minLevel !== undefined && level < options.minLevel) return
  if (options?.maxLevel !== undefined && level > options.maxLevel) return

  const text = match[2].replace(/[ \t]+#+[ \t]*$/, '').trim()
  return text ? { level, text } : undefined
}

export function getCodeFenceMarker(line: string) {
  return /^(?: {0,3})(`{3,}|~{3,})/u.exec(line)?.[1]
}

export function isMatchingFenceMarker(marker: string, other: string) {
  return marker[0] === other[0]
}

export function trimBlankLines(lines: Array<string>) {
  let start = 0
  let end = lines.length

  while (start < end && !(lines[start] ?? '').trim()) start++
  while (end > start && !(lines[end - 1] ?? '').trim()) end--

  return lines.slice(start, end)
}

export function createDocCopySource(rawSource: unknown) {
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

    const packageLinks = rewritePackageLinksComponent(lines, index)
    if (packageLinks) {
      output.push(...packageLinks.lines)
      index = packageLinks.endIndex
      continue
    }

    output.push(line)
  }

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function getDocHeadings(rawSource: unknown, renderedHeadings: Array<Heading>) {
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

export function getStepId(title: string, stepSlugCounts: Map<string, number>) {
  const baseSlug = slugifyHeading(title) || 'step'
  const count = stepSlugCounts.get(baseSlug) ?? 0
  stepSlugCounts.set(baseSlug, count + 1)
  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
}

export function normalizeDocSearchHighlightTerms(terms: Array<string> | undefined) {
  return [...new Set((terms ?? []).map((term) => term.trim()).filter(Boolean))]
    .filter((term) => !docSearchHighlightStopwords.has(term.toLowerCase()))
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
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

function rewritePackageLinksComponent(lines: Array<string>, index: number) {
  const firstLine = lines[index]!
  if (!/^\s*<PackageLinks(?:\s|$)/u.test(firstLine)) return

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

  const propsMatch = /^<PackageLinks\s+(.+?)\s*\/?>$/u.exec(componentLines.join(' '))
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
