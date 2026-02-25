import { expect, test } from 'vitest'
import { urlSchema } from '#lib/schemas.ts'

// valid URLs

test('accepts full https url', () => {
  expect(urlSchema.parse('https://example.com')).toBe('https://example.com/')
})

test('accepts full http url', () => {
  expect(urlSchema.parse('http://example.com')).toBe('http://example.com/')
})

test('prepends https when no protocol', () => {
  expect(urlSchema.parse('example.com')).toBe('https://example.com/')
})

test('preserves path and query', () => {
  expect(urlSchema.parse('example.com/docs?q=test')).toBe(
    'https://example.com/docs?q=test',
  )
})

test('preserves fragment', () => {
  expect(urlSchema.parse('example.com/page#section')).toBe(
    'https://example.com/page#section',
  )
})

test('accepts subdomain', () => {
  expect(urlSchema.parse('docs.example.com')).toBe('https://docs.example.com/')
})

// invalid URLs

test('rejects empty string', () => {
  expect(() => urlSchema.parse('')).toThrow()
})

test('rejects non-http protocol', () => {
  expect(() => urlSchema.parse('ftp://example.com')).toThrow()
})

test('rejects invalid domain', () => {
  expect(() => urlSchema.parse('not a url')).toThrow()
})
