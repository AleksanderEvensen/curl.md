import { expect, test } from 'vitest'
import {
  generateDocsLlmsFullTxt,
  generateDocsLlmsTxt,
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
