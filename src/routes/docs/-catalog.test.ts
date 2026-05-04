import { expect, test } from 'vitest'
import { findDoc, findDocPagination, searchDocs } from './-catalog.ts'

test('docs index participates in pagination before sidebar docs', () => {
  expect(findDocPagination('')).toEqual({
    next: expect.objectContaining({ path: 'getting-started', title: 'Getting Started' }),
    previous: undefined,
  })

  expect(findDocPagination('getting-started')).toEqual({
    next: expect.anything(),
    previous: expect.objectContaining({ path: '', title: 'Introduction' }),
  })
})

test('brand page is routable but omitted from docs search', () => {
  expect(findDoc('brand')).toEqual(expect.objectContaining({ path: 'brand', title: 'Brand' }))
  expect(searchDocs('brand')).not.toContainEqual(expect.objectContaining({ path: 'brand' }))
})
