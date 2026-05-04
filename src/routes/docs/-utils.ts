import type { ComponentType } from 'react'
import { type Heading } from '#lib/docs.ts'

export type { Heading } from '#lib/docs.ts'

export type MdxComponentMap = Record<string, any>

export type Doc = {
  Component: ComponentType<{ components?: MdxComponentMap }>
  description: string | undefined
  headings: Array<Heading>
  lastUpdated?: string
  outlineMaxLevel?: number
  path: string
  search?: boolean
  source: string
  sourcePath: string
  title: string
}

export type DocPagination = {
  next: Pick<Doc, 'path' | 'title'> | undefined
  previous: Pick<Doc, 'path' | 'title'> | undefined
}

export const docSearchHighlightClassName = 'bg-amber7 text-black'

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

export function getDocSearchHighlightRanges(value: string, terms: Array<string> | undefined) {
  if (!value) return []

  const pattern = createDocSearchHighlightRegExp(terms)
  if (!pattern) return []

  const ranges: Array<{ end: number; start: number }> = []

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const previousRange = ranges.at(-1)

    if (
      previousRange &&
      (start <= previousRange.end ||
        isDocSearchHighlightJoiner(value.slice(previousRange.end, start)))
    ) {
      previousRange.end = end
      continue
    }

    ranges.push({ end, start })
  }

  return ranges
}

export function normalizeDocSearchHighlightTerms(terms: Array<string> | undefined) {
  return [...new Set((terms ?? []).map((term) => term.trim()).filter(Boolean))]
    .filter((term) => !docSearchHighlightStopwords.has(term.toLowerCase()))
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
}

function createDocSearchHighlightRegExp(terms: Array<string> | undefined) {
  const normalizedTerms = normalizeDocSearchHighlightTerms(terms)
  if (!normalizedTerms.length) return undefined

  return new RegExp(`(${normalizedTerms.map((term) => escapeRegExp(term)).join('|')})`, 'giu')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isDocSearchHighlightJoiner(value: string) {
  return /^[\s_]*$/u.test(value)
}
