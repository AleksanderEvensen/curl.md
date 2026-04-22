import { expect, test } from 'vitest'
import { appendVaryAccept, negotiateAccept, parseAcceptHeader } from '#lib/accept.ts'

test('parseAcceptHeader falls back to wildcard when header is missing', () => {
  expect(parseAcceptHeader(null)).toEqual([
    { order: 0, q: 1, specificity: 0, subtype: '*', type: '*' },
  ])
})

test('parseAcceptHeader parses q values and ignores invalid media types', () => {
  expect(parseAcceptHeader('text/html;q=0.5, invalid, text/markdown;q=2')).toEqual([
    { order: 0, q: 0.5, specificity: 2, subtype: 'html', type: 'text' },
    { order: 2, q: 1, specificity: 2, subtype: 'markdown', type: 'text' },
  ])
})

test('negotiateAccept prefers higher q values', () => {
  const match = negotiateAccept('text/html;q=0.5, text/markdown;q=1', (acceptedValue) => {
    if (acceptedValue.type !== 'text') return null
    if (acceptedValue.subtype === 'html') return 'html' as const
    if (acceptedValue.subtype === 'markdown') return 'markdown' as const
    return null
  })

  expect(match).toBe('markdown')
})

test('negotiateAccept prefers more specific matches, then earlier entries', () => {
  const specificMatch = negotiateAccept('text/*, text/html', (acceptedValue) => {
    if (acceptedValue.type !== 'text') return null
    if (acceptedValue.subtype === '*' || acceptedValue.subtype === 'html') return 'html' as const
    return null
  })
  expect(specificMatch).toBe('html')

  const orderedMatch = negotiateAccept('text/markdown, text/html', (acceptedValue) => {
    if (acceptedValue.type !== 'text') return null
    if (acceptedValue.subtype === 'html') return 'html' as const
    if (acceptedValue.subtype === 'markdown') return 'markdown' as const
    return null
  })
  expect(orderedMatch).toBe('markdown')
})

test('appendVaryAccept preserves existing vary entries without duplicating Accept', async () => {
  const response = appendVaryAccept(
    new Response('hello', {
      headers: { vary: 'Origin, Accept', 'x-test': '1' },
      status: 201,
      statusText: 'Created',
    }),
  )

  expect(response.headers.get('vary')).toBe('Origin, Accept')
  expect(response.headers.get('x-test')).toBe('1')
  expect(response.status).toBe(201)
  expect(response.statusText).toBe('Created')
  await expect(response.text()).resolves.toBe('hello')
})
