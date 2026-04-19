import path from 'node:path'
import { expect, test } from 'vitest'
import { docs } from './vite.ts'

test('docsMdx does not rewrite directive syntax inside fenced code blocks', async () => {
  const code = await transformDocs(
    `
# Example

\`\`\`
:::danger Keep this literal
Danger body
:::
\`\`\`
`.trim(),
  )

  expect(code).toContain(':::danger Keep this literal')
  expect(code).not.toContain('type: "caution"')
})

test('docsMdx leaves legacy space-delimited notice titles unchanged', async () => {
  const code = await transformDocs(
    `
# Example

:::danger Read carefully
You only need one install path.
:::
`.trim(),
  )

  expect(code).toContain(':::danger Read carefully')
  expect(code).not.toContain('Notice')
})

test('docsMdx supports standard remark-directive labels for notices', async () => {
  const code = await transformDocs(
    `
# Example

:::danger[Read carefully]
You only need one install path.
:::
`.trim(),
  )

  expect(code).toContain('Notice')
  expect(code).toContain('type: "caution"')
  expect(code).toContain('title: "Read carefully"')
  expect(code).not.toContain('directiveLabel')
})

test('docsMdx leaves GitHub-style alerts as blockquotes', async () => {
  const code = await transformDocs(
    `
# Example

> [!TIP]
> Keep this as a regular blockquote.
`.trim(),
  )

  expect(code).toContain('[!TIP]')
  expect(code).not.toContain('Notice')
})

test('docsMdx leaves unterminated directives unchanged', async () => {
  const code = await transformDocs(
    `
# Example

:::steps

### Install dependencies

Run the installer before starting the app.
`.trim(),
  )

  expect(code).toContain(':::steps')
  expect(code).not.toContain('title: "Install dependencies"')
  expect(code).not.toContain('_missingMdxReference("Steps"')
  expect(code).not.toContain('_missingMdxReference("Step"')
})

test('docsMdx rewrites steps directives with tilde-fenced code blocks', async () => {
  const code = await transformDocs(
    `
# Example

:::steps

### Start the app

~~~sh
docker compose up -d
~~~

:::
`.trim(),
    'docs/development/contributing.mdx',
  )

  expect(code).toContain('Steps')
  expect(code).toContain('Step')
  expect(code).toContain('title: "Start the app"')
  expect(code).toContain('className: "language-sh"')
  expect(code).not.toContain(':::steps')
})

test('docsMdx rewrites codegroup directives into tabbed code group components', async () => {
  const code = await transformDocs(
    `
# Example

:::codegroup

\`\`\`sh [pnpm]
pnpm dev
\`\`\`

\`\`\`ts [config.ts]
export const config = {}
\`\`\`

:::
`.trim(),
  )

  expect(code).toContain('CodeGroup')
  expect(code).toContain('label: "pnpm"')
  expect(code).toContain('label: "config.ts"')
  expect(code).toContain('className: "language-sh"')
  expect(code).toContain('className: "language-ts"')
  expect(code).not.toContain('language-text')
  expect(code).not.toContain(':::codegroup')
})

test('docsMdx preserves fenced code block titles on highlighted pre elements', async () => {
  const code = await transformDocs(
    `
# Example

\`\`\`ts title="config.ts"
export const config = {}
\`\`\`
`.trim(),
  )

  expect(code).toContain('title: "config.ts"')
  expect(code).toContain('className: "language-ts"')
})

test('docsMdx strips shell prompts before highlighting prompt-style shell blocks', async () => {
  const code = await transformDocs(
    `
# Example

\`\`\`sh
$ pnpm test:e2e
\`\`\`
`.trim(),
  )

  expect(code).toContain('"data-shell-prompt": ""')
  expect(code).toContain('children: "pnpm"')
  expect(code).not.toContain('children: "$"')
})

test('docsMdx strips authored chevron shell prompts before highlighting', async () => {
  const code = await transformDocs(
    `
# Example

\`\`\`sh
❯ pnpm test:e2e
\`\`\`
`.trim(),
  )

  expect(code).toContain('"data-shell-prompt": ""')
  expect(code).toContain('children: "pnpm"')
  expect(code).not.toContain('children: "❯"')
})

test('docsMdx highlights inline code when the snippet declares a language', async () => {
  const code = await transformDocs(
    `
# Example

Use \`pnpm add curl.md{:sh}\` with \`curl.config.ts{:ts}\`.
`.trim(),
  )

  expect(code).toContain('data-shiki-inline-code')
  expect(code).toContain('children: "pnpm"')
  expect(code).not.toContain('{:sh}')
  expect(code).not.toContain('{:ts}')
})

test('docsMdx leaves raw imports untouched', async () => {
  const source = `---
title: Installation
---

# Installation

:::tip[Pick one install path]
You only need one installation path.
:::
`
  const code = await transformDocs(source, 'docs/getting-started/installation.mdx?raw')

  expect(code).toBe(source)
})

test('docsMdx rewrites steps directives into numbered step components', async () => {
  const code = await transformDocs(
    `
# Example

:::steps

### Install dependencies

Run the installer before starting the app.

### Start the app

\`\`\`sh
docker compose up -d
\`\`\`

:::
`.trim(),
    'docs/development/contributing.mdx',
  )

  expect(code).toContain('Steps')
  expect(code).toContain('Step')
  expect(code).toContain('title: "Install dependencies"')
  expect(code).toContain('title: "Start the app"')
  expect(code).not.toContain(':::steps')
})

test('docsMdx parses gfm tables into table elements', async () => {
  const code = await transformDocs(
    `
# Example

| Runtime | Install Command |
| --- | --- |
| Node.js | pnpm add curl.md |
`.trim(),
  )

  expect(code).toContain('_components.table')
  expect(code).toContain('_components.thead')
  expect(code).toContain('_components.tbody')
  expect(code).toContain('_components.tr')
  expect(code).toContain('_components.th')
  expect(code).toContain('_components.td')
})

test('docsMdx rewrites card directives into grouped card components', async () => {
  const code = await transformDocs(
    `
# Example

:::card[Install curl.md]{href=/docs/install icon=rocket}
Start from the terminal.
:::

:::card[Amp plugin]{href=/docs/amp icon=book}
Enable docs fetch interception.
:::
`.trim(),
  )

  expect(code).toContain('{Card, Cards}')
  expect(code).toContain('title: "Install curl.md"')
  expect(code).toContain('href: "/docs/install"')
  expect(code).toContain('icon: "rocket"')
  expect(code).toContain('title: "Amp plugin"')
  expect(code).toContain('href: "/docs/amp"')
  expect(code).toContain('icon: "book"')
  expect(code).not.toContain(':::card')
})

test('docsMdx groups adjacent cards separated by blank lines', async () => {
  const code = await transformDocs(
    `
# Example

:::card[First]{href=/a icon=terminal}
A description.
:::

:::card[Second]{href=/b icon=key}
B description.
:::
`.trim(),
  )

  const cardsMatches = code.match(/_jsxs?\(Cards/g)
  expect(cardsMatches?.length).toBe(1)
})

test('docsMdx breaks card groups when non-card content intervenes', async () => {
  const code = await transformDocs(
    `
# Example

:::card[First]{href=/a icon=terminal}
A description.
:::

A paragraph of text.

:::card[Second]{href=/b icon=key}
B description.
:::
`.trim(),
  )

  const cardsMatches = code.match(/_jsxs?\(Cards/g)
  expect(cardsMatches?.length).toBe(2)
})

test('docsMdx does not group hand-authored Card JSX blocks', async () => {
  const code = await transformDocs(
    `
# Example

<Card href="/a" title="First">A description.</Card>

<Card href="/b" title="Second">B description.</Card>
`.trim(),
  )

  expect(code).toContain('{Card} = _components')
  expect(code).not.toContain('{Card, Cards}')
  expect(code).not.toContain('_jsx(Cards')
  expect(code).not.toContain('_jsxs(Cards')
})

test('docsMdx does not rewrite card directives inside fenced code blocks', async () => {
  const code = await transformDocs(
    `
# Example

\`\`\`
:::card[Keep literal]{href=/docs/foo icon=wallet}
Body text.
:::
\`\`\`
`.trim(),
  )

  expect(code).toContain(':::card[Keep literal]')
  expect(code).not.toContain('{Card,')
})

test('docsMdx renders cards without an icon attribute', async () => {
  const code = await transformDocs(
    `
# Example

:::card[No icon]{href=/docs/foo}
Just a plain card.
:::
`.trim(),
  )

  expect(code).toContain('{Card, Cards}')
  expect(code).toContain('title: "No icon"')
  expect(code).toContain('href: "/docs/foo"')
})

async function transformDocs(source: string, filePath = 'docs/reference/kitchen-sink.mdx') {
  const [pathName, query = ''] = filePath.split('?', 2)
  const transformed = await docs().transform?.call(
    {},
    source,
    query ? `${path.join(process.cwd(), pathName!)}?${query}` : path.join(process.cwd(), pathName!),
  )
  return typeof transformed === 'string'
    ? transformed
    : ((transformed as { code?: string } | null | undefined)?.code ?? '')
}
