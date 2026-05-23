import { Hono } from 'hono'
import { accepts } from 'hono/accepts'
import { estimateTokenCount } from 'tokenx'
import { stringify as yamlStringify } from 'yaml'
import { z } from 'zod'
import * as Nanoid from '#lib/nanoid.ts'
import * as Md from '#md/index.ts'

const app = new Hono<{ Bindings: Cloudflare.Env }>()

app.use(async (c, next) => {
  const token = (() => {
    const authorization = c.req.header('authorization')
    if (authorization?.startsWith('Bearer ')) return authorization.replace('Bearer ', '')
    return c.req.query('token') ?? c.req.query('t')
  })()

  if (!c.env.SELFHOST_API_KEY || token !== c.env.SELFHOST_API_KEY)
    return c.json({ code: 'invalid_api_key', message: 'Invalid API key' }, 401)

  await next()
})

app.get('/api/auth/me', (c) =>
  c.json(
    {
      account: {
        avatar_url: null,
        email: 'selfhost@localhost',
        id: 'selfhost',
        login: 'selfhost',
        name: 'Selfhost',
        organizations: [],
        role: 'crew' as const,
      },
    },
    200,
  ),
)

app.get('/api/orgs', (c) => c.json({ organizations: [] }, 200))

app.get('/api/:url{.+}', async (c) => {
  const query = z.parse(
    z
      .object({
        anchor: z.string().optional(),
        f: z.union([z.literal('').transform(() => true), z.coerce.boolean()]).optional(),
        fresh: z.union([z.literal('').transform(() => true), z.coerce.boolean()]).optional(),
        k: z
          .string()
          .transform((v) => v.split(/[\s,]+/).filter(Boolean))
          .optional(),
        keywords: z
          .string()
          .transform((v) => v.split(/[\s,]+/).filter(Boolean))
          .optional(),
        o: z.string().optional(),
        objective: z.string().optional(),
        q: z.string().optional(),
      })
      .transform((v) => ({
        anchor: v.anchor,
        fresh: v.fresh || v.f || false,
        keywords: v.keywords ?? v.k,
        objective: v.objective ?? v.q ?? v.o,
      })),
    c.req.query(),
  )

  if (query.objective)
    return c.json(
      {
        code: 'ai_disabled' as const,
        message: 'AI objective extraction is disabled in self-hosted mode',
      },
      400,
    )

  const requestURL = new URL(c.req.param('url'))
  const url = new URL(requestURL)
  url.hash = ''

  const accept = accepts(c, {
    default: 'text/markdown',
    header: 'Accept',
    match(accepts) {
      const accept = accepts.find((accept) => {
        if (accept.q <= 0) return false
        const type = accept.type.toLowerCase()
        return type === '*/*' || type === 'application/json' || type === 'text/markdown'
      })
      if (!accept) return 'not_acceptable'
      if (accept.type === '*/*') return 'text/markdown'
      return accept.type.toLowerCase()
    },
    supports: ['application/json', 'text/markdown'],
  })
  if (accept === 'not_acceptable')
    return c.json({ code: 'not_acceptable' as const, message: 'Not Acceptable' }, 406, {
      vary: 'Accept',
    })

  const md = Md.create({
    headers: {
      'User-Agent': `Mozilla/5.0 (compatible; ${c.env.HOST}/1.0; +https://${c.env.HOST})`,
    },
    profiles: Md.profiles,
    rules: Md.rules,
    transport: Md.transports.fetch(),
  })

  let cached = false
  const response = await (async () => {
    const pageCacheKey = `page:${url.href}` as const
    const pageCached = await c.env.KV.get(pageCacheKey, 'json')
    if (!query.fresh && pageCached) {
      cached = true
      return { ...pageCached, ok: true as const, status: 200 }
    }
    const result = await md.fetch(url)
    if (!result.ok) return result
    c.executionCtx.waitUntil(
      c.env.KV.put(
        pageCacheKey,
        JSON.stringify({
          content: result.content,
          meta: result.meta,
          extras: result.extras,
        }),
        { expirationTtl: 900 }, // 15 minutes
      ),
    )
    return result
  })()

  if (!response.ok)
    return c.json(
      {
        code: 'fetch_failed' as const,
        message: response.error || `Upstream returned ${response.status}`,
      },
      502,
    )

  const filteredContent = query.keywords?.length
    ? Md.filterSectionsByKeywords(response.content, query.keywords)
    : response.content
  const frontmatter = (() => {
    const yaml = yamlStringify(response.meta, { lineWidth: 0 }).trimEnd()
    return yaml ? `---\n${yaml}\n---` : undefined
  })()
  const markdownDocument = frontmatter ? `${frontmatter}\n\n${response.content}` : response.content
  const filteredDocument = (() => {
    if (!query.keywords?.length) return null
    if (frontmatter) return `${frontmatter}\n\n${filteredContent}`
    return filteredContent
  })()
  const finalDocument = filteredDocument ?? markdownDocument
  const sourceTokens = response.extras.source_tokens ?? estimateTokenCount(markdownDocument)
  const finalTokens = estimateTokenCount(finalDocument)

  const headers = {
    'access-control-expose-headers': 'x-cache, x-request-id, x-tokens-count, x-tokens-saved',
    vary: 'Accept',
    'x-cache': cached ? 'HIT' : 'MISS',
    'x-robots-tag': 'noindex, nofollow',
    'x-request-id': Nanoid.generate(),
    'x-tokens-count': String(finalTokens),
    'x-tokens-saved': String(sourceTokens - finalTokens),
  }

  if (accept === 'application/json') return c.json({ content: finalDocument }, 200, headers)
  return c.text(finalDocument, 200, { ...headers, 'content-type': 'text/markdown; charset=utf-8' })
})

export default app
