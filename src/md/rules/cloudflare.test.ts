import { expect, test } from 'vitest'
import { create } from '../mod.ts'
import { cloudflare } from './cloudflare.ts'

test('cloudflare requests first-party markdown', async () => {
  let request: Request | undefined
  const markdown = `---
title: API token permissions
description: Review available Cloudflare API token permissions.
---

## User permissions

| Name | Description |
| --- | --- |
| User Details Edit | Grants write access to user details. |
`

  const md = create({
    rules: [cloudflare()],
    fetch: async (input, init) => {
      request = input instanceof Request ? input : new Request(input, init)
      return new Response(markdown, {
        status: 200,
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      })
    },
  })

  const result = await md.fetch(
    'https://developers.cloudflare.com/fundamentals/api/reference/permissions/',
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(request?.url).toBe(
    'https://developers.cloudflare.com/fundamentals/api/reference/permissions/index.md',
  )
  expect(request?.headers.get('accept')).toBe('text/markdown')
  expect(result.meta.title).toBe('API token permissions')
  expect(result.meta.description).toBe('Review available Cloudflare API token permissions.')
  expect(result.content).toContain('## User permissions')
  expect(result.content).toContain('| User Details Edit | Grants write access to user details. |')
})

test('cloudflare trims blank padding inside first-party markdown code fences', async () => {
  const md = create({
    fetch: async () =>
      new Response('```\n\nlower(http.host) == "www.cloudflare.com"\n\n\n```\n', {
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
        status: 200,
      }),
    rules: [cloudflare()],
  })

  const result = await md.fetch(
    'https://developers.cloudflare.com/ruleset-engine/rules-language/functions/',
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(result.content).toBe('```\nlower(http.host) == "www.cloudflare.com"\n```')
})

test('cloudflare rewrites slashless docs pages to /index.md', async () => {
  let request: Request | undefined

  const md = create({
    rules: [cloudflare()],
    fetch: async (input, init) => {
      request = input instanceof Request ? input : new Request(input, init)
      return new Response('# Workers\n', {
        status: 200,
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      })
    },
  })

  const result = await md.fetch('https://developers.cloudflare.com/workers')
  expect(result.ok).toBe(true)
  expect(request?.url).toBe('https://developers.cloudflare.com/workers/index.md')
  expect(request?.headers.get('accept')).toBe('text/markdown')
})

test('cloudflare treats llms.txt text/plain responses as markdown', async () => {
  let request: Request | undefined
  const md = create({
    rules: [cloudflare()],
    fetch: async (input, init) => {
      request = input instanceof Request ? input : new Request(input, init)
      return new Response('# Cloudflare Developer Documentation\n', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    },
  })

  const result = await md.fetch('https://developers.cloudflare.com/llms.txt')
  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(request?.url).toBe('https://developers.cloudflare.com/llms.txt')
  expect(result.content).toContain('# Cloudflare Developer Documentation')
  expect(request?.headers.get('accept')).toBe('text/markdown')
})
