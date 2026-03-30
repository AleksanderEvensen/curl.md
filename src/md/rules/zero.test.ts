import { expect, test } from 'vitest'
import { create } from '../mod.ts'
import { zero } from './zero.ts'

test('zero rewrites docs URLs to raw mdx', () => {
  const result = zero().rewrite?.(
    new URL('https://zero.rocicorp.dev/docs/quickstart'),
    {} as URLPatternResult,
  )
  expect(result?.href).toBe(
    'https://raw.githubusercontent.com/rocicorp/zero-docs/main/contents/docs/quickstart.mdx',
  )
})

test('zero does not match non-docs URLs', () => {
  const rule = zero()
  const match = rule.patterns[0]!.exec('https://zero.rocicorp.dev/')
  expect(match).toBeNull()
})

test('zero strips CodeGroup and adds titles to code blocks', async () => {
  const fence = '`'.repeat(3)
  const mdx = `---
title: Install
---

import { CodeGroup } from "~/components";

<CodeGroup
  labels={[
    {text: 'npm', sync: {pm: 'npm'}},
    {text: 'pnpm', sync: {pm: 'pnpm'}},
    {text: 'yarn', sync: {pm: 'yarn'}},
  ]}
>

${fence}bash
npx zero-cache-dev
${fence}

${fence}bash
pnpm exec zero-cache-dev
${fence}

${fence}bash
yarn exec zero-cache-dev
${fence}

</CodeGroup>

## Usage

<Step title="Create a schema">

Define your schema.

</Step>

<Video
src="/video/onboarding/zero-cache-sync.mp4"
alt="Zero-cache syncing between Postgres and SQLite"
animation
/>

<Callout type="info">
This is a note.
</Callout>
`

  const md = create({
    rules: [zero()],
    fetch: async () =>
      new Response(mdx, { status: 200, headers: { 'content-type': 'text/plain' } }),
  })

  const result = await md.fetch('https://zero.rocicorp.dev/docs/install')
  expect(result.ok).toBe(true)
  if (!result.ok) return

  expect(result.content).toContain(`${fence}bash title="npm"`)
  expect(result.content).toContain(`${fence}bash title="pnpm"`)
  expect(result.content).toContain(`${fence}bash title="yarn"`)
  expect(result.content).not.toContain('<CodeGroup')
  expect(result.content).not.toContain('</CodeGroup>')
  expect(result.content).not.toContain('<Step')
  expect(result.content).not.toContain('</Step>')
  expect(result.content).not.toContain('<Video')
  expect(result.content).toContain(
    '[Zero-cache syncing between Postgres and SQLite](/video/onboarding/zero-cache-sync.mp4)',
  )
  expect(result.content).not.toContain('<Callout')
  expect(result.content).not.toContain('</Callout>')
  expect(result.content).not.toContain('import {')
  expect(result.content).toContain('## Usage')
  expect(result.content).toContain('Define your schema.')
  expect(result.content).toContain('This is a note.')
})
