import { expect, test } from 'vitest'
import type { ScoreResult } from '#lib/score.ts'
import { computeScore } from '#lib/score.ts'

function getCategory(result: ScoreResult, label: string) {
  const c = result.categories.find((c) => c.label === label)
  if (!c) throw new Error(`Category "${label}" not found`)
  return c
}

const defaults = {
  rawHtmlLength: 10_000,
  tokensCount: 500,
  tokensSaved: 500,
}

// overall

test('well-structured markdown scores high', () => {
  const markdown = [
    '# My Page',
    '',
    'Introduction paragraph with **bold** text.',
    '',
    '## Section One',
    '',
    'Some content with a [link](https://example.com).',
    '',
    '- Item one',
    '- Item two',
    '',
    '## Section Two',
    '',
    'More content here.',
  ].join('\n')
  const result = computeScore({ ...defaults, markdown })
  expect(result.overall).toBeGreaterThanOrEqual(80)
})

test('empty markdown scores lower than well-structured', () => {
  const result = computeScore({ ...defaults, markdown: '' })
  expect(result.overall).toBeLessThan(85)
  expect(getCategory(result, 'Structure').score).toBeLessThan(70)
})

// structure

test('penalizes missing headings', () => {
  const markdown = 'Just a plain paragraph without any headings at all.'
  const result = computeScore({ ...defaults, markdown })
  const structure = getCategory(result, 'Structure')
  expect(structure.score).toBeLessThan(70)
  expect(structure.tips).toContain('Add headings to provide document structure')
})

test('penalizes multiple h1s', () => {
  const markdown = '# First\n\nContent\n\n# Second\n\nMore content'
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Structure').tips).toContain(
    'Use only one h1 heading per page',
  )
})

test('penalizes heading level skips', () => {
  const markdown = '# Title\n\n### Skipped h2\n\nContent'
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Structure').tips).toContain(
    'Avoid skipping heading levels (e.g. h1 to h3)',
  )
})

test('suggests lists for long content without lists', () => {
  const markdown = `# Title\n\n${'A '.repeat(300)}`
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Structure').tips).toContain(
    'Consider using lists for structured content',
  )
})

// noise

test('penalizes excessive blank lines', () => {
  const markdown = `# Title\n\n\n\n\nA\n\n\n\n\nB\n\n\n\n\nC\n\n\n\n\nD`
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Noise').tips).toContain(
    'Reduce excessive blank lines in output',
  )
})

test('penalizes leftover html tags', () => {
  const markdown =
    '# Page\n\n<div>one</div><span>two</span><p>three</p><a>four</a><section>five</section><nav>six</nav>'
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Noise').tips).toContain(
    'Clean up leftover HTML tags in the markdown',
  )
})

test('penalizes boilerplate navigation text', () => {
  const markdown = [
    '# Page',
    'skip to content',
    'cookie policy',
    'privacy policy',
    'terms of service',
    'sign in',
    'subscribe',
  ].join('\n')
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Noise').tips).toContain(
    'Reduce navigation and boilerplate text in output',
  )
})

// metadata

test('penalizes missing title', () => {
  const markdown = 'No title here, just a paragraph.'
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Metadata').tips).toContain(
    'Include a clear page title as an h1 heading',
  )
})

test('penalizes missing links in long content', () => {
  const markdown = `# Title\n\n${'Some text without links. '.repeat(20)}`
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Metadata').tips).toContain(
    'Include relevant links for context',
  )
})

test('penalizes images without alt text', () => {
  const markdown = '# Page\n\n![](image.png)'
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Metadata').tips).toContain(
    'Add alt text to images for better context',
  )
})

// compression

test('penalizes poor compression ratio', () => {
  const result = computeScore({
    markdown: '# Page\n\nContent',
    rawHtmlLength: 1000,
    tokensCount: 900,
    tokensSaved: 10,
  })
  expect(getCategory(result, 'Compression').score).toBeLessThan(80)
})

test('handles zero rawHtmlLength', () => {
  const result = computeScore({
    markdown: '# Page',
    rawHtmlLength: 0,
    tokensCount: 100,
    tokensSaved: 50,
  })
  const compression = getCategory(result, 'Compression')
  expect(compression.score).toBe(50)
  expect(compression.tips).toContain('Could not measure raw HTML size')
})

// readability

test('penalizes very long paragraphs', () => {
  const longParagraph = 'A '.repeat(600)
  const markdown = `# Title\n\n${longParagraph}\n\n${longParagraph}\n\n${longParagraph}`
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Readability').tips).toContain(
    'Break up long paragraphs for better readability',
  )
})

test('penalizes very short content', () => {
  const result = computeScore({ ...defaults, markdown: '# Hi' })
  expect(getCategory(result, 'Readability').tips).toContain(
    'Page produced very little markdown content',
  )
})

test('suggests bold for long content without emphasis', () => {
  const markdown = `# Title\n\n${'Plain text without any emphasis. '.repeat(40)}`
  const result = computeScore({ ...defaults, markdown })
  expect(getCategory(result, 'Readability').tips).toContain(
    'Consider using bold text to highlight key information',
  )
})
