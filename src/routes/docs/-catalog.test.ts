import { expect, test } from 'vitest'
import { findDocPagination } from './-catalog.ts'

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
