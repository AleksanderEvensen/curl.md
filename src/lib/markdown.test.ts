import { describe, expect, test } from 'vitest'

import { htmlToMarkdown } from '#lib/markdown.ts'

describe('htmlToMarkdown', () => {
  test('basic html conversion', async () => {
    const { markdown: result } = await htmlToMarkdown('<p>Hello</p>')
    expect(result).toBe('Hello\n')
  })

  test('converts heading and paragraph', async () => {
    const { markdown: result } = await htmlToMarkdown(
      '<h1>Title</h1><p>Body</p>',
    )
    expect(result).toContain('# Title')
    expect(result).toContain('Body')
  })

  test('converts links', async () => {
    const { markdown: result } = await htmlToMarkdown(
      '<a href="https://example.com">link</a>',
    )
    expect(result).toContain('[link](https://example.com)')
  })

  test('extracts title as frontmatter', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ head: '<title>My Page</title>', body: '<p>content</p>' }),
    )
    expect(result).toContain('title: "My Page"')
  })

  test('extracts meta description', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta name="description" content="A description">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('description: "A description"')
  })

  test('extracts og:description as fallback', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta property="og:description" content="OG desc">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('description: "OG desc"')
  })

  test('name=description takes priority over og:description', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta name="description" content="Name desc"><meta property="og:description" content="OG desc">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('description: "Name desc"')
  })

  test('extracts author', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta name="author" content="John">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('author: "John"')
  })

  test('extracts og:site_name', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta property="og:site_name" content="My Site">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('site: "My Site"')
  })

  test('extracts article:published_time as publish_date', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta property="article:published_time" content="2024-01-15T00:00:00Z">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('publish_date: "2024-01-15T00:00:00Z"')
  })

  test('extracts date as publish_date', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta name="date" content="2024-03-01">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('publish_date: "2024-03-01"')
  })

  test('article:published_time takes priority over date', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<meta property="article:published_time" content="2024-01-15"><meta name="date" content="2024-03-01">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('publish_date: "2024-01-15"')
  })

  test('extracts canonical url', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: '<link rel="canonical" href="https://example.com/page">',
        body: '<p>content</p>',
      }),
    )
    expect(result).toContain('url: "https://example.com/page"')
  })

  test('no frontmatter when no head metadata', async () => {
    const { markdown: result } = await htmlToMarkdown('<p>text</p>')
    expect(result).not.toContain('---')
  })

  test('full document with all metadata', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        head: [
          '<title>Full Page</title>',
          '<meta name="author" content="Jane">',
          '<meta name="description" content="Full description">',
          '<meta property="og:site_name" content="Full Site">',
          '<link rel="canonical" href="https://example.com/full">',
        ].join(''),
        body: '<h1>Welcome</h1><p>Hello world</p>',
      }),
    )
    expect(result).toContain('---')
    expect(result).toContain('title: "Full Page"')
    expect(result).toContain('author: "Jane"')
    expect(result).toContain('description: "Full description"')
    expect(result).toContain('site: "Full Site"')
    expect(result).toContain('url: "https://example.com/full"')
    expect(result).toContain('# Welcome')
    expect(result).toContain('Hello world')
  })
})

describe('strips noise elements', () => {
  test('strips nav elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<nav><a href="/">Home</a></nav><p>Content</p>' }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Home')
  })

  test('preserves header elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<header><h1>Site Title</h1></header><main><p>Content</p></main>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).toContain('Site Title')
  })

  test('strips footer elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<p>Content</p><footer><p>Copyright 2024</p></footer>' }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Copyright')
  })

  test('strips aside elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<aside><p>Sidebar</p></aside><p>Content</p>' }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Sidebar')
  })

  test('strips script and style tags', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<script>alert("hi")</script><style>body{}</style><p>Content</p>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('alert')
    expect(result).not.toContain('body{}')
  })

  test('strips noscript and iframe', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<noscript>Enable JS</noscript><iframe src="x"></iframe><p>Content</p>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Enable JS')
  })

  test('strips svg elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<svg><circle r="5"/></svg><p>Content</p>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('circle')
  })

  test('strips elements by role attribute', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<div role="navigation"><a href="/">Nav</a></div><div role="banner">Banner</div><div role="contentinfo">Info</div><div role="complementary">Side</div><p>Content</p>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Nav')
    expect(result).not.toContain('Banner')
    expect(result).not.toContain('Info')
    expect(result).not.toContain('Side')
  })

  test('preserves main content', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<main><h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul></main>',
      }),
    )
    expect(result).toContain('# Title')
    expect(result).toContain('Paragraph')
    expect(result).toContain('Item')
  })

  test('strips nested noise', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<nav><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav><article><p>Article content</p></article>',
      }),
    )
    expect(result).toContain('Article content')
    expect(result).not.toContain('Home')
    expect(result).not.toContain('About')
  })
})

describe('resolves relative links', () => {
  const baseUrl = 'https://example.com/docs/page'

  test('resolves relative href', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<a href="/about">About</a>' }),
      { baseUrl },
    )
    expect(result).toContain('[About](https://example.com/about)')
  })

  test('resolves relative src', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<img src="/img/photo.jpg" alt="Photo">' }),
      { baseUrl },
    )
    expect(result).toContain('https://example.com/img/photo.jpg')
  })

  test('preserves absolute links', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<a href="https://other.com">Other</a>' }),
      { baseUrl },
    )
    expect(result).toContain('[Other](https://other.com)')
  })

  test('strips hash-only links', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<a href="#section">Jump</a><p>Content</p>' }),
      { baseUrl },
    )
    expect(result).not.toContain('Jump')
    expect(result).toContain('Content')
  })

  test('resolves path-relative links', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<a href="sibling">Sibling</a>' }),
      { baseUrl },
    )
    expect(result).toContain('(https://example.com/docs/sibling)')
  })

  test('no-op without baseUrl', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<a href="/about">About</a>' }),
    )
    expect(result).toContain('(/about)')
  })
})

describe('strips empty elements', () => {
  test('strips empty paragraphs', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<p></p><p>Content</p>' }),
    )
    expect(result).toContain('Content')
    expect(result).toBe('Content\n')
  })

  test('strips whitespace-only paragraphs', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<p>   </p><p>Content</p>' }),
    )
    expect(result).toBe('Content\n')
  })

  test('strips empty headings', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<h2></h2><p>Content</p>' }),
    )
    expect(result).toBe('Content\n')
  })

  test('strips empty list items', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<ul><li></li><li>Item</li></ul>' }),
    )
    expect(result).toContain('Item')
    expect(result).not.toContain('* \n')
  })

  test('preserves non-empty elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({ body: '<p>Keep</p><div>Also keep</div>' }),
    )
    expect(result).toContain('Keep')
    expect(result).toContain('Also keep')
  })
})

describe('strips HTML comments', () => {
  test('strips React SSR hydration markers', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<!--$--><p>Content</p><!--/$--><!--$!--><!--/$-->',
      }),
    )
    expect(result).toBe('Content\n')
  })

  test('strips arbitrary comments', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<!--gEFrenCoRRJPVzAxJzheZ--><h1>Title<!-- --> here</h1>',
      }),
    )
    expect(result).toBe('# Title here\n')
  })
})

describe('pre newlines', () => {
  test('does not double newlines in syntax-highlighted code blocks', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<pre><code><span>line1</span>\n<span>line2</span>\n<span>line3</span></code></pre>',
      }),
    )
    expect(result).toContain('line1\nline2\nline3')
    expect(result).not.toContain('line1\n\nline2')
  })

  test('strips extra blank lines from pretty-printed div code blocks', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<pre><code>\n<div>line1</div>\n<div>line2</div>\n<div>line3</div>\n</code></pre>',
      }),
    )
    expect(result).toContain('line1\nline2\nline3')
    expect(result).not.toContain('line1\n\nline2')
  })

  test('strips trailing br inside div-per-line code blocks', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<pre><code><div class="cm-line"><span>line1</span><br/></div><div class="cm-line"><span>line2</span><br/></div><div class="cm-line"><span>line3</span><br/></div></code></pre>',
      }),
    )
    expect(result).toContain('line1\nline2\nline3')
    expect(result).not.toContain('line1\n\nline2')
  })
})

describe('strips form elements', () => {
  test('strips form elements', async () => {
    const { markdown: result } = await htmlToMarkdown(
      html({
        body: '<form><input type="text"><button>Submit</button></form><p>Content</p>',
      }),
    )
    expect(result).toContain('Content')
    expect(result).not.toContain('Submit')
  })
})

function html(props: { body?: string; head?: string }) {
  return `<!doctype html><html><head>${props.head ?? ''}</head><body>${props.body ?? ''}</body></html>`
}
