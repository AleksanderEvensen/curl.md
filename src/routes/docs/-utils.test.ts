import { expect, test } from 'vitest'
import { createDocCopySource, getDocHeadings } from '#lib/docs.ts'

const fence = '`'.repeat(3)

test('createDocCopySource strips frontmatter and preserves markdown notice directives', () => {
  const source = `---
title: Installation
description: Install curl.md
---

# Installation

:::tip[Pick one install path]
You only need one installation path.
:::
`

  expect(createDocCopySource(source)).toBe(`# Installation

:::tip[Pick one install path]
You only need one installation path.
:::`)
})

test('createDocCopySource strips top-level imports and preserves code groups', () => {
  const source = `# Kitchen Sink

import { create } from 'curl.md'

${fence}ts
import { rules } from 'curl.md'
${fence}

:::codegroup

${fence}sh [npm]
npm run dev
${fence}

${fence}sh [pnpm]
pnpm dev
${fence}

:::
`

  expect(createDocCopySource(source)).toBe(`# Kitchen Sink

${fence}ts
import { rules } from 'curl.md'
${fence}

:::codegroup

${fence}sh [npm]
npm run dev
${fence}

${fence}sh [pnpm]
pnpm dev
${fence}

:::`)
})

test('createDocCopySource accepts raw module objects from SSR glob imports', () => {
  expect(
    createDocCopySource({
      default: `---
title: Installation
---

# Installation`,
    }),
  ).toBe('# Installation')
})

test('createDocCopySource preserves steps directives', () => {
  const source = `# Contributing

:::steps

### Install and start OrbStack

OrbStack provides the local Docker runtime on macOS.

### Start the app

${fence}sh
docker compose up -d
${fence}

:::
`

  expect(createDocCopySource(source)).toBe(`# Contributing

:::steps

### Install and start OrbStack

OrbStack provides the local Docker runtime on macOS.

### Start the app

${fence}sh
docker compose up -d
${fence}

:::`)
})

test('createDocCopySource preserves variable-length notice fences', () => {
  const source = `# Installation

::::tip[Pick one install path]
You only need one installation path.
::::
`

  expect(createDocCopySource(source)).toBe(`# Installation

::::tip[Pick one install path]
You only need one installation path.
::::`)
})

test('createDocCopySource leaves legacy space-delimited notice titles unchanged', () => {
  const source = `# Installation

:::tip Pick one install path
You only need one installation path.
:::
`

  expect(createDocCopySource(source)).toBe(`# Installation

:::tip Pick one install path
You only need one installation path.
:::`)
})

test('createDocCopySource rewrites PackageLinks into markdown links', () => {
  const source = `# Amp

<PackageLinks npm="@curl.md/amp" source="https://github.com/wevm/curl.md/tree/main/plugins/amp" />
`

  expect(createDocCopySource(source)).toBe(`# Amp

- [@curl.md/amp](https://www.npmjs.com/package/@curl.md/amp)
- [Source code](https://github.com/wevm/curl.md/tree/main/plugins/amp)`)
})

test('createDocCopySource rewrites multiline PackageLinks into markdown links', () => {
  const source = `# OpenCode

<PackageLinks
  npm="@curl.md/opencode"
  source="https://github.com/wevm/curl.md/tree/main/plugins/opencode"
/>
`

  expect(createDocCopySource(source)).toBe(`# OpenCode

- [@curl.md/opencode](https://www.npmjs.com/package/@curl.md/opencode)
- [Source code](https://github.com/wevm/curl.md/tree/main/plugins/opencode)`)
})

test('createDocCopySource ignores imported PackageLinks version props', () => {
  const source = `import packageJson from '../../plugins/pi/package.json'

# Pi

<PackageLinks
  npm="@curl.md/pi"
  source="https://github.com/wevm/curl.md/tree/main/plugins/pi"
  version={packageJson.version}
/>
`

  expect(createDocCopySource(source)).toBe(`# Pi

- [@curl.md/pi](https://www.npmjs.com/package/@curl.md/pi)
- [Source code](https://github.com/wevm/curl.md/tree/main/plugins/pi)`)
})

test('createDocCopySource strips SignedOutOnly wrappers and preserves inner markdown', () => {
  const source = `# Introduction

<SignedOutOnly>

:::note[Sign up]
[Sign up for a free account](/login) for higher limits.
:::

</SignedOutOnly>
`

  expect(createDocCopySource(source)).toBe(`# Introduction

:::note[Sign up]
[Sign up for a free account](/login) for higher limits.
:::`)
})

test('getDocHeadings includes numbered step headings from nested variable-length steps fences', () => {
  const source = `## Quick Start

::::steps
### Install

Run the installer.

### Run Amp CLI

:::tip
Add PLUGINS=all to your environment.
:::

### Use Amp

Ask Amp to read a page.
::::
`

  expect(getDocHeadings(source, [{ id: 'quick-start', level: 2, text: 'Quick Start' }])).toEqual([
    { id: 'quick-start', level: 2, text: 'Quick Start' },
    { id: 'install', level: 3, text: '1. Install' },
    { id: 'run-amp-cli', level: 3, text: '2. Run Amp CLI' },
    { id: 'use-amp', level: 3, text: '3. Use Amp' },
  ])
})

test('getDocHeadings prefers numbered synthetic step headings over duplicate rendered step headings', () => {
  const source = `## Quick Start

::::steps
### Install

Run the installer.

### Use Amp

Ask Amp to read a page.
::::

## Example
`

  expect(
    getDocHeadings(source, [
      { id: 'quick-start', level: 2, text: 'Quick Start' },
      { id: 'install', level: 3, text: 'Install' },
      { id: 'use-amp', level: 3, text: 'Use Amp' },
      { id: 'example', level: 2, text: 'Example' },
    ]),
  ).toEqual([
    { id: 'quick-start', level: 2, text: 'Quick Start' },
    { id: 'install', level: 3, text: '1. Install' },
    { id: 'use-amp', level: 3, text: '2. Use Amp' },
    { id: 'example', level: 2, text: 'Example' },
  ])
})
