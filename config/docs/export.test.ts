import { expect, test } from 'vitest'
import {
  generateDocsLlmsFullTxt,
  generateDocsLlmsTxt,
  generateSitemapXml,
  getDocsInSidebarOrder,
  getDocsLlmsSections,
  rewriteGeneratedDocsLinks,
} from './export.ts'

test('rewriteGeneratedDocsLinks rewrites docs links to generated markdown paths', () => {
  expect(
    rewriteGeneratedDocsLinks(
      `
[Introduction](/docs)
[Installation](/docs/getting-started/installation)
[Quick Start](/docs/getting-started/quick-start?view=full#cli)
[Kitchen Sink](/docs/reference/kitchen-sink.md#examples)
[Guide](/guide)
[External](https://example.com/docs)
`.trim(),
    ),
  ).toBe(
    `
[Introduction](/docs/index.md)
[Installation](/docs/getting-started/installation.md)
[Quick Start](/docs/getting-started/quick-start.md?view=full#cli)
[Kitchen Sink](/docs/reference/kitchen-sink.md#examples)
[Guide](/guide)
[External](https://example.com/docs)
`.trim(),
  )
})

test('getDocsLlmsSections follows sidebar order, flattens nested groups, and skips missing docs', () => {
  const sections = getDocsLlmsSections(
    new Map([
      [
        'development/contributing',
        {
          description: 'Set up curl.md locally and run the main contributor workflows.',
          path: 'development/contributing',
          title: 'Contributing',
        },
      ],
      [
        '',
        {
          description: 'URL to markdown for agents',
          path: '',
          title: 'Introduction',
        },
      ],
      [
        'getting-started/quick-start',
        {
          description: 'Get started with curl.md',
          path: 'getting-started/quick-start',
          title: 'Quick Start',
        },
      ],
    ]),
    [
      { label: 'Introduction', path: '/', type: 'link' },
      {
        items: [
          { label: 'Installation', path: '/getting-started/installation', type: 'link' },
          { label: 'Quick Start', path: '/getting-started/quick-start', type: 'link' },
        ],
        label: 'Getting Started',
        type: 'group',
      },
      {
        items: [
          {
            items: [{ label: 'Contributing', path: '/development/contributing', type: 'link' }],
            label: 'Contributor Guide',
            type: 'group',
          },
        ],
        label: 'Development',
        type: 'group',
      },
      {
        items: [{ label: 'Missing', path: '/missing', type: 'link' }],
        label: 'Reference',
        type: 'group',
      },
    ],
  )

  expect(sections).toEqual([
    {
      docs: [{ description: 'URL to markdown for agents', path: '', title: 'Introduction' }],
      title: 'Overview',
    },
    {
      docs: [
        {
          description: 'Get started with curl.md',
          path: 'getting-started/quick-start',
          title: 'Quick Start',
        },
      ],
      title: 'Getting Started',
    },
    {
      docs: [
        {
          description: 'Set up curl.md locally and run the main contributor workflows.',
          path: 'development/contributing',
          title: 'Contributing',
        },
      ],
      title: 'Development',
    },
  ])
})

test('generateDocsLlmsTxt includes the published docs in sidebar order', () => {
  const llms = generateDocsLlmsTxt({
    sections: [
      {
        docs: [{ description: 'URL to markdown for agents', path: '', title: 'Introduction' }],
        title: 'Overview',
      },
      {
        docs: [
          {
            description: 'Install the curl.md CLI',
            path: 'getting-started/installation',
            title: 'Installation',
          },
          {
            description: 'Get started with curl.md',
            path: 'getting-started/quick-start',
            title: 'Quick Start',
          },
        ],
        title: 'Getting Started',
      },
      {
        docs: [
          {
            description: 'Set up curl.md locally and run the main contributor workflows.',
            path: 'development/contributing',
            title: 'Contributing',
          },
          { description: undefined, path: 'reference/kitchen-sink', title: 'Kitchen Sink' },
        ],
        title: 'Development',
      },
    ],
  })

  expect(llms).toContain('# curl.md Docs')
  expect(llms).toContain(
    '# curl.md Docs\n\n> Canonical curl.md documentation for installation, usage, and development.',
  )
  expect(llms).toContain('## Overview')
  expect(llms).toContain(
    '## Overview\n\n- [Introduction](/docs/index.md): URL to markdown for agents',
  )
  expect(llms).toContain('## Getting Started')
  expect(llms).toContain(
    '## Getting Started\n\n- [Installation](/docs/getting-started/installation.md): Install the curl.md CLI',
  )
  expect(llms).toContain('## Development')
  expect(llms).toContain('- [Introduction](/docs/index.md): URL to markdown for agents')
  expect(llms).toContain(
    '- [Installation](/docs/getting-started/installation.md): Install the curl.md CLI',
  )
  expect(llms).toContain(
    '- [Quick Start](/docs/getting-started/quick-start.md): Get started with curl.md',
  )
  expect(llms).toContain(
    '- [Contributing](/docs/development/contributing.md): Set up curl.md locally and run the main contributor workflows.',
  )
  expect(llms).toContain('- [Kitchen Sink](/docs/reference/kitchen-sink.md): Kitchen Sink')

  expect(llms.indexOf('Introduction')).toBeLessThan(llms.indexOf('Installation'))
  expect(llms.indexOf('Installation')).toBeLessThan(llms.indexOf('Quick Start'))
  expect(llms.indexOf('Quick Start')).toBeLessThan(llms.indexOf('Contributing'))
  expect(llms.indexOf('Contributing')).toBeLessThan(llms.indexOf('Kitchen Sink'))
})

test('generateSitemapXml includes public routes and docs pages', () => {
  expect(
    generateSitemapXml({
      docs: [
        { lastUpdated: '2026-01-01T00:00:00.000Z', path: '' },
        { path: 'getting-started' },
        { lastUpdated: '2026-01-02T00:00:00.000Z', path: 'guide/cli' },
      ],
    }),
  ).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://curl.md/</loc>
  </url>
  <url>
    <loc>https://curl.md/docs</loc>
    <lastmod>2026-01-01T00:00:00.000Z</lastmod>
  </url>
  <url>
    <loc>https://curl.md/playground</loc>
  </url>
  <url>
    <loc>https://curl.md/docs/getting-started</loc>
  </url>
  <url>
    <loc>https://curl.md/docs/guide/cli</loc>
    <lastmod>2026-01-02T00:00:00.000Z</lastmod>
  </url>
</urlset>
`)
})

test('generateDocsLlmsFullTxt combines the docs into one markdown document', () => {
  const llmsFull = generateDocsLlmsFullTxt({
    docs: [
      {
        description: 'URL to markdown for agents',
        path: '',
        source: '# Introduction\n\nHello world.',
        title: 'Introduction',
      },
      {
        description: 'Install the curl.md CLI',
        path: 'getting-started/installation',
        source: '# Installation\n\nRun the installer.',
        title: 'Installation',
      },
    ],
  })

  expect(llmsFull).toContain('# curl.md Docs Full')
  expect(llmsFull).toContain(
    '# curl.md Docs Full\n\n> Full markdown export of the canonical curl.md documentation.',
  )
  expect(llmsFull).toContain(
    '## /docs/index.md\n\nURL to markdown for agents\n\n# Introduction\n\nHello world.',
  )
  expect(llmsFull).toContain(
    '## /docs/getting-started/installation.md\n\nInstall the curl.md CLI\n\n# Installation\n\nRun the installer.',
  )
  expect(llmsFull.indexOf('## /docs/index.md')).toBeLessThan(
    llmsFull.indexOf('## /docs/getting-started/installation.md'),
  )
})

test('getDocsInSidebarOrder follows sidebar order and appends docs missing from the sidebar', () => {
  const docs = getDocsInSidebarOrder(
    new Map([
      [
        '',
        {
          description: 'URL to markdown for agents',
          path: '',
          source: '# Introduction',
          title: 'Introduction',
        },
      ],
      [
        'install',
        {
          description: 'Install the curl.md CLI',
          path: 'install',
          source: '# Installation',
          title: 'Installation',
        },
      ],
      [
        'guide/cli',
        {
          description: 'Use curl.md from the terminal',
          path: 'guide/cli',
          source: '# CLI',
          title: 'CLI',
        },
      ],
    ]),
    [
      {
        items: [
          { label: 'CLI', path: '/guide/cli', type: 'link' },
          { label: 'Installation', path: '/install', type: 'link' },
        ],
        label: 'Guide',
        type: 'group',
      },
    ],
  )

  expect(docs.map((doc) => doc.path)).toEqual(['guide/cli', 'install', ''])
})

test('getDocsLlmsSections and llms-full inputs can exclude legal docs', () => {
  const docs = [
    {
      description: 'Privacy policy',
      path: 'privacy',
      source: '# Privacy Policy',
      title: 'Privacy Policy',
    },
    {
      description: 'Terms of use',
      path: 'terms',
      source: '# Terms of Use',
      title: 'Terms of Use',
    },
    {
      description: 'URL to markdown for agents',
      path: '',
      source: '# Introduction',
      title: 'Introduction',
    },
  ]

  const llmsDocs = docs.filter((doc) => !new Set(['privacy', 'terms']).has(doc.path))
  const sections = getDocsLlmsSections(new Map(llmsDocs.map((doc) => [doc.path, doc])), [
    { label: 'Introduction', path: '/', type: 'link' },
    { label: 'Terms of Use', path: '/terms', type: 'link' },
    { label: 'Privacy Policy', path: '/privacy', type: 'link' },
  ])
  const llmsFull = generateDocsLlmsFullTxt({ docs: llmsDocs })

  expect(sections).toHaveLength(1)
  expect(sections[0]?.title).toBe('Overview')
  expect(sections[0]?.docs.map((doc) => doc.path)).toEqual([''])
  expect(llmsFull).toContain('## /docs/index.md')
  expect(llmsFull).not.toContain('/docs/privacy.md')
  expect(llmsFull).not.toContain('/docs/terms.md')
})
