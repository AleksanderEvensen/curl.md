/** Map of hostname → transform to get the markdown URL. */
export const knownMdSites = new Map<string, (url: URL) => URL | undefined>([
  ['developers.cloudflare.com', appendIndexMd],
  ['bun.sh', prefixedWithIndex('/docs')],
  ['docs.tempo.xyz', appendMdWithIndex],
  ['github.com', githubRaw],
  ['planetscale.com', prefixedWithIndex('/docs')],
  ['vercel.com', prefixedWithIndex('/docs')],
  ['viem.sh', appendMdWithIndex],
])

/** If the URL matches a known site, return the markdown URL. */
export function toMdUrl(url: URL): URL | undefined {
  return knownMdSites.get(url.hostname)?.(url)
}

function appendMd(url: URL): URL {
  const mdUrl = new URL(url.href)
  mdUrl.pathname = `${mdUrl.pathname}.md`
  return mdUrl
}

function appendIndexMd(url: URL): URL {
  const mdUrl = new URL(url.href)
  const base = mdUrl.pathname.endsWith('/')
    ? mdUrl.pathname
    : `${mdUrl.pathname}/`
  mdUrl.pathname = `${base}index.md`
  return mdUrl
}

function appendMdWithIndex(url: URL): URL {
  const mdUrl = new URL(url.href)
  mdUrl.pathname = url.pathname.endsWith('/')
    ? `${mdUrl.pathname}index.md`
    : `${mdUrl.pathname}.md`
  return mdUrl
}

function githubRaw(url: URL): URL | undefined {
  const match = url.pathname.match(/^\/([^/]+\/[^/]+)\/blob\/(.+)/)
  if (!match) return
  return new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}`)
}

function prefixedWithIndex(prefix: string): (url: URL) => URL | undefined {
  return (url) => {
    if (!url.pathname.startsWith(`${prefix}/`) && url.pathname !== prefix)
      return
    if (url.pathname === prefix || url.pathname === `${prefix}/`) {
      const mdUrl = new URL(url.href)
      mdUrl.pathname = `${prefix}/index.md`
      return mdUrl
    }
    return appendMd(url)
  }
}
