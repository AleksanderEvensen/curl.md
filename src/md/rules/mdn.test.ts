import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { create } from '../mod.ts'
import { mdn } from './mdn.ts'

const fixture = readFileSync(
  path.resolve(import.meta.dirname, '__fixtures__/mdn-array-map.md'),
  'utf8',
)

// Rewrite tests

test('rewrites en-US docs URL to mdn/content repo', () => {
  const rule = mdn()
  const url = new URL(
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
  )
  const pattern = rule.patterns[0]
  assert(pattern instanceof URLPattern)
  const match = pattern.exec(url)!
  const result = rule.rewrite!(url, match)
  expect(result?.href).toBe(
    'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/javascript/reference/global_objects/array/map/index.md',
  )
})

test('rewrites non-English locale to mdn/translated-content repo', () => {
  const rule = mdn()
  const url = new URL(
    'https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
  )
  const pattern = rule.patterns[0]
  assert(pattern instanceof URLPattern)
  const match = pattern.exec(url)!
  const result = rule.rewrite!(url, match)
  expect(result?.href).toBe(
    'https://raw.githubusercontent.com/mdn/translated-content/main/files/ja/web/javascript/reference/global_objects/array/map/index.md',
  )
})

test('lowercases slug in rewritten URL', () => {
  const rule = mdn()
  const url = new URL('https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement')
  const pattern = rule.patterns[0]
  assert(pattern instanceof URLPattern)
  const match = pattern.exec(url)!
  const result = rule.rewrite!(url, match)
  expect(result?.pathname).toBe('/mdn/content/main/files/en-us/web/api/htmlelement/index.md')
})

test('rewrites locale-less docs URL to mdn/content repo', () => {
  const rule = mdn()
  const url = new URL('https://developer.mozilla.org/docs/Web/API/Fetch_API/Using_Fetch')
  const pattern = rule.patterns[1]
  assert(pattern instanceof URLPattern)
  const match = pattern.exec(url)!
  const result = rule.rewrite!(url, match)
  expect(result?.href).toBe(
    'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/fetch_api/using_fetch/index.md',
  )
})

// Integration test

test('extract produces expected output for Array.prototype.map', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () => new Response(fixture, { status: 200 }),
  })
  const result = await md.fetch(
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  await expect(result.content).toMatchFileSnapshot('__snapshots__/mdn-array-map.md')
  expect(result.meta.title).toBe('Array.prototype.map()')
})

test('locale-less docs URL uses markdown source so code fence info stays on the fence', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async (input) => {
      const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
      expect(url).toBe(
        'https://raw.githubusercontent.com/mdn/content/main/files/en-us/web/api/fetch_api/using_fetch/index.md',
      )
      return new Response('---\ntitle: Test\n---\n\n```js\nconst x = 1\n```', { status: 200 })
    },
  })
  const result = await md.fetch('https://developer.mozilla.org/docs/Web/API/Fetch_API/Using_Fetch')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain('```js\nconst x = 1')
  expect(result.content).not.toContain('\njs\n\n```')
})

// Extract behavior tests

test('converts jsxref macros to linked inline code', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response('---\ntitle: Test\n---\n\nSee {{jsxref("Array")}}.', {
        status: 200,
      }),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain(
    '[`Array`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)',
  )
  expect(result.content).not.toContain('{{')
})

test('strips Specifications and Compat macros', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response(
        '---\ntitle: Test\n---\n\nHello\n\n{{Specifications}}\n\n{{Compat}}\n\nGoodbye',
        { status: 200 },
      ),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).not.toContain('{{Specifications}}')
  expect(result.content).not.toContain('{{Compat}}')
  expect(result.content).toContain('Hello')
  expect(result.content).toContain('Goodbye')
})

test('resolves {{Specifications}} to spec table from frontmatter', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response(
        '---\ntitle: Test\nspec-urls: https://example.spec.whatwg.org/\n---\n\n## Specifications\n\n{{Specifications}}\n\nContent',
        { status: 200 },
      ),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain('| Specification |')
  expect(result.content).toContain('https://example.spec.whatwg.org/')
  expect(result.content).not.toContain('{{Specifications}}')
})

test('resolves {{Specifications}} with multiple spec-urls', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response(
        '---\ntitle: Test\nspec-urls:\n  - https://a.spec.org/\n  - https://b.spec.org/\n---\n\n{{Specifications}}',
        { status: 200 },
      ),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain('https://a.spec.org/')
  expect(result.content).toContain('https://b.spec.org/')
})

test('resolves {{Compat}} to browser compat table', async () => {
  const rule = mdn()
  const res = new Response(
    '---\ntitle: Test\nbrowser-compat: api.Foo\n---\n\n## Browser compatibility\n\n{{Compat}}\n\nContent',
    { status: 200 },
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
    if (url.includes('browser-compat-data'))
      return new Response(
        JSON.stringify({
          api: {
            Foo: {
              __compat: {
                support: {
                  chrome: { version_added: '90' },
                  edge: 'mirror',
                  firefox: { version_added: '88' },
                  safari: { version_added: false },
                  chrome_android: 'mirror',
                  safari_ios: 'mirror',
                },
              },
            },
          },
        }),
        { status: 200 },
      )
    return originalFetch(input)
  }
  try {
    const result = await rule.extract!(res)
    expect(result.content).toContain('| | Chrome |')
    expect(result.content).toContain('| Foo | 90 |')
    expect(result.content).toContain('| 88 |')
    expect(result.content).toContain('| No |')
    expect(result.content).not.toContain('{{Compat}}')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('resolves {{Specifications}} from BCD spec_url when no spec-urls in frontmatter', async () => {
  const rule = mdn()
  const res = new Response(
    '---\ntitle: Test\nbrowser-compat: api.Foo\n---\n\n## Specifications\n\n{{Specifications}}\n\n## Browser compatibility\n\n{{Compat}}',
    { status: 200 },
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
    if (url.includes('browser-compat-data'))
      return new Response(
        JSON.stringify({
          api: {
            Foo: {
              __compat: {
                spec_url: 'https://example.spec.org/#foo',
                support: { chrome: { version_added: '90' } },
              },
            },
          },
        }),
        { status: 200 },
      )
    return originalFetch(input)
  }
  try {
    const result = await rule.extract!(res)
    expect(result.content).toContain('| Specification |')
    expect(result.content).toContain('https://example.spec.org/#foo')
    expect(result.content).not.toContain('{{Specifications}}')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('strips {{Compat}} when no browser-compat in frontmatter', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response('---\ntitle: Test\n---\n\nHello\n\n{{Compat}}\n\nGoodbye', {
        status: 200,
      }),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).not.toContain('{{Compat}}')
  expect(result.content).toContain('Hello')
  expect(result.content).toContain('Goodbye')
})

test('converts optional_inline macro to _(optional)_', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response('---\ntitle: Test\n---\n\n- `param` {{optional_inline}}', {
        status: 200,
      }),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain('_(optional)_')
  expect(result.content).not.toContain('{{optional_inline}}')
})

test('cleans code block info strings', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response('---\ntitle: Test\n---\n\n```js-nolint\nconst x = 1\n```', {
        status: 200,
      }),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).toContain('```js\n')
  expect(result.content).not.toContain('js-nolint')
})

test('strips InteractiveExample macros', async () => {
  const md = create({
    rules: [mdn()],
    fetch: async () =>
      new Response(
        '---\ntitle: Test\n---\n\n{{InteractiveExample("pages/js/array-map.html")}}\n\nContent here',
        { status: 200 },
      ),
  })
  const result = await md.fetch('https://developer.mozilla.org/en-US/docs/Web/Test')
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.content).not.toContain('InteractiveExample')
  expect(result.content).toContain('Content here')
})
