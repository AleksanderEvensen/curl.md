import { describe, expect, it } from 'vitest'
import { extractMetadata } from './convert'

describe('extractMetadata', () => {
  it('extracts title from <title> tag', () => {
    const html = '<html><head><title>My Page</title></head></html>'
    const result = extractMetadata(html)
    expect(result.title).toBe('My Page')
  })

  it('extracts publish date from article:published_time', () => {
    const html =
      '<meta property="article:published_time" content="2024-01-15" />'
    const result = extractMetadata(html)
    expect(result.publishDate).toBe('2024-01-15')
  })

  it('extracts publish date from datePublished meta', () => {
    const html = '<meta name="datePublished" content="2024-06-01" />'
    const result = extractMetadata(html)
    expect(result.publishDate).toBe('2024-06-01')
  })

  it('returns null when no metadata present', () => {
    const html = '<html><body><p>No metadata here</p></body></html>'
    const result = extractMetadata(html)
    expect(result.title).toBeNull()
    expect(result.publishDate).toBeNull()
  })
})
