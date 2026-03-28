import { expect, test } from 'vitest'
import { create } from '../mod.ts'
import { cloudflare } from './cloudflare.ts'

const tab = String.fromCharCode(9)

test('cloudflare rewrites docs URLs to raw mdx', () => {
  const result = cloudflare().rewrite?.(
    new URL('https://developers.cloudflare.com/workers/wrangler/configuration/'),
    {} as URLPatternResult,
  )
  expect(result?.href).toBe(
    'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/wrangler/configuration.mdx',
  )
})

test('cloudflare falls back to index.mdx and normalizes mdx', async () => {
  const requests: string[] = []
  const fence = '`'.repeat(3)
  const mdx = `---
title: Bindings
description: A guide to
  bindings.
---

import { InlineBadge, WranglerConfig } from "~/components";

<WranglerConfig>

${fence}ts
const env = true
${fence}

${fence}json
{
${tab}"name": "my-worker",
${tab}"main": "./index.js",
${tab}"vars": {
${tab}${tab}"MY_VARIABLE": "staging variable"
${tab}}
}
${fence}

1. Example:

  ${fence}json
  {
  ${tab}"name": "my-worker",
  ${tab}"main": "./index.js",
  ${tab}"vars": {
  ${tab}${tab}"MY_VARIABLE": "staging variable"
  ${tab}}
  }
  ${fence}

</WranglerConfig>

- \`keep_vars\` <Type text="boolean" /> <MetaInfo text="optional" />
- \`html_handling\`: <Type text={'"auto-trailing-slash" | "none"'} /> <MetaInfo text={'optional, defaults to "auto-trailing-slash"'} />

<Render
  file="bindings-note"
  product="workers"
/>

<a
  href="https://developers.cloudflare.com/changelog/"
  target="_blank"
>
  <InlineBadge preset="beta" />
</a>

## Bindings

See [Cache](/workers/runtime-apis/cache/).
`

  const md = create({
    rules: [cloudflare()],
    fetch: async (input) => {
      const url = input instanceof URL ? input.href : input instanceof Request ? input.url : input
      requests.push(url)
      if (url.endsWith('/workers/runtime-apis/bindings.mdx'))
        return new Response(null, { status: 404 })
      if (url.endsWith('/workers/runtime-apis/bindings/index.mdx'))
        return new Response(mdx, { status: 200, headers: { 'content-type': 'text/plain' } })
      return new Response(null, { status: 404 })
    },
  })

  const result = await md.fetch('https://developers.cloudflare.com/workers/runtime-apis/bindings/')
  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(requests).toEqual([
    'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/runtime-apis/bindings.mdx',
    'https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/runtime-apis/bindings/index.mdx',
  ])
  expect(result.meta.title).toBe('Bindings')
  expect(result.meta.description).toBe('A guide to bindings.')
  expect(result.content).toContain('## Bindings')
  expect(result.content).toContain('- `keep_vars`  `boolean`  _optional_')
  expect(result.content).toContain(
    '- `html_handling`:  `"auto-trailing-slash" | "none"`  _optional, defaults to "auto-trailing-slash"_',
  )
  expect(result.content).toContain('```ts\nconst env = true\n```')
  expect(result.content).toContain(
    '```json\n{\n  "name": "my-worker",\n  "main": "./index.js",\n  "vars": {\n    "MY_VARIABLE": "staging variable"\n  }\n}\n```',
  )
  expect(result.content).toContain(
    '  ```json\n  {\n    "name": "my-worker",\n    "main": "./index.js",\n    "vars": {\n      "MY_VARIABLE": "staging variable"\n    }\n  }\n  ```',
  )
  expect(result.content).toContain('[Cache](/workers/runtime-apis/cache/)')
  expect(result.content).not.toContain('import {')
  expect(result.content).not.toContain('<WranglerConfig>')
  expect(result.content).not.toContain('<Render')
  expect(result.content).not.toContain('<InlineBadge')
  expect(result.content).not.toContain('<a')
})
