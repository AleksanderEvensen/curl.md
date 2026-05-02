import { defineRule } from '../mod.ts'

type Options = Required<Pick<defineRule.Config, 'key' | 'patterns'>> &
  Pick<defineRule.Config, 'checks'>

type RawRepoOptions = Options & {
  branch?: string
  extension: '.md' | '.mdx'
  indexName?: string
  prefix: string
  repo: string
  stripPrefix?: string
}

export function appendMd(options: Options) {
  return defineRule({
    ...options,
    rewrite(url) {
      const mdUrl = new URL(url.href)
      mdUrl.pathname = `${mdUrl.pathname}.md`
      return mdUrl
    },
  })
}

export function appendMdWithoutHtml(options: Options) {
  return defineRule({
    ...options,
    rewrite(url) {
      const mdUrl = new URL(url.href)
      mdUrl.pathname = `${mdUrl.pathname.replace(/\.html$/, '')}.md`
      return mdUrl
    },
  })
}

export function appendMdWithIndex(options: Options) {
  return defineRule({
    ...options,
    rewrite(url) {
      const mdUrl = new URL(url.href)
      mdUrl.pathname = url.pathname.endsWith('/')
        ? `${mdUrl.pathname}index.md`
        : `${mdUrl.pathname}.md`
      return mdUrl
    },
  })
}

export function prefixedWithIndex(options: Options & { prefix: string }) {
  const { prefix: _, ...rest } = options
  return defineRule({
    ...rest,
    rewrite(url) {
      if (!url.pathname.startsWith(`${options.prefix}/`) && url.pathname !== options.prefix) return
      if (url.pathname === options.prefix || url.pathname === `${options.prefix}/`) {
        const mdUrl = new URL(url.href)
        mdUrl.pathname = `${options.prefix}/index.md`
        return mdUrl
      }
      const mdUrl = new URL(url.href)
      mdUrl.pathname = `${mdUrl.pathname}.md`
      return mdUrl
    },
  })
}

export function acceptMarkdown(options: Options) {
  return defineRule({
    ...options,
    fetch(url, init, { fetch }) {
      return fetch(url, {
        ...init,
        headers: { ...init?.headers, Accept: 'text/markdown' },
      })
    },
  })
}

export function repo(
  options: Options & {
    repo: string
    branch?: string
    prefix?: string
  },
) {
  const { branch = 'main', prefix, ...rest } = options
  return defineRule({
    ...rest,
    rewrite(url) {
      if (url.pathname === '/' || url.pathname === '') return
      return new URL(
        `https://raw.githubusercontent.com/${options.repo}/${branch}${prefix ? `/${prefix}` : ''}${url.pathname}.md`,
      )
    },
  })
}

export function githubPageMarkdown(options: Options) {
  return defineRule({
    ...options,
    async fetch(input, init, { fetch }) {
      const response = await fetch(input, init)
      if (!response.ok) return response

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml'))
        return response

      const html = await response.text()
      const sourceUrl = extractGithubMarkdownUrl(html)
      if (!sourceUrl) return cloneResponse(html, response)

      const rawUrl = githubRawMarkdownUrl(sourceUrl)
      if (!rawUrl) return cloneResponse(html, response)

      const markdownResponse = await fetch(rawUrl, init)
      if (!markdownResponse.ok) return cloneResponse(html, response)
      const content = await markdownResponse.text()

      const headers = new Headers(markdownResponse.headers)
      headers.set('content-type', 'text/markdown; charset=utf-8')
      return new Response(
        rawUrl.pathname.endsWith('.mdx') ? normalizeGithubMdx(content) : content,
        {
          headers,
          status: markdownResponse.status,
          statusText: markdownResponse.statusText,
        },
      )
    },
  })
}

export function rawRepoWithIndex(options: RawRepoOptions) {
  return defineRule({
    ...options,
    rewrite(url) {
      return rawRepoCandidates(url, options)[0]
    },
    async fetch(input, init, { fetch }) {
      let lastResponse = new Response(null, { status: 404 })
      for (const candidate of rawRepoCandidates(asUrl(input), options)) {
        const response = await fetch(candidate, init)
        if (response.ok) return response
        if (response.status !== 404) return response
        lastResponse = response
      }
      return lastResponse
    },
  })
}

function asUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input
  if (input instanceof Request) return new URL(input.url)
  return new URL(input)
}

function cloneResponse(body: string, response: Response): Response {
  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function normalizeGithubMdx(content: string): string {
  return content
    .replace(/^import\s+[\s\S]+?from\s+['"][^'"]+['"];?\n*/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\n*/gm, '')
}

function extractGithubMarkdownUrl(html: string): string | undefined {
  const match =
    html.match(/"githubFileUrl":"(https:\/\/github\.com\/[^"\\]+\/blob\/[^"\\]+?\.mdx?)"/i) ??
    html.match(/href=["'](https:\/\/github\.com\/[^"']+\/edit\/[^"']+?\.mdx?)(?:#[^"']*)?["']/i) ??
    html.match(/href=["'](https:\/\/github\.com\/[^"']+\/blob\/[^"']+?\.mdx?)(?:#[^"']*)?["']/i)
  if (!match?.[1]) return
  return match[1].replaceAll('&amp;', '&').replaceAll(' ', '%20')
}

function githubRawMarkdownUrl(url: string): URL | undefined {
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:blob|edit)\/([^/]+)\/(.+\.mdx?)$/,
  )
  if (!match) return
  return new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`)
}

function rawRepoCandidates(url: URL, options: RawRepoOptions): URL[] {
  const pathname = rawRepoPathname(url, options)
  const relative =
    options.stripPrefix && pathname.startsWith(options.stripPrefix)
      ? pathname.slice(options.stripPrefix.length) || '/'
      : pathname
  const trimmed = relative === '/' ? '' : relative.replace(/\/$/, '')
  const indexName = options.indexName ?? 'index'
  const paths = [
    `${trimmed || `/${indexName}`}${options.extension}`,
    `${trimmed || ''}/${indexName}${options.extension}`,
  ]
  return [...new Set(paths)].map(
    (path) =>
      new URL(
        `https://raw.githubusercontent.com/${options.repo}/${options.branch ?? 'main'}/${options.prefix}${path}`,
      ),
  )
}

function rawRepoPathname(url: URL, options: RawRepoOptions): string {
  if (url.hostname !== 'raw.githubusercontent.com') return url.pathname || '/'

  const prefix = `/${options.repo}/${options.branch ?? 'main'}/${options.prefix}`
  if (!url.pathname.startsWith(prefix)) return url.pathname || '/'

  const relative = url.pathname.slice(prefix.length) || '/'
  const indexName = options.indexName ?? 'index'
  if (relative.endsWith(`/${indexName}${options.extension}`))
    return relative.slice(0, -`/${indexName}${options.extension}`.length) || '/'
  if (relative.endsWith(options.extension))
    return relative.slice(0, -options.extension.length) || '/'
  return relative
}
