import { env, waitUntil } from 'cloudflare:workers'
import { getDb } from '#lib/db.ts'

export function trackRequest(
  request: Request,
  params: {
    hostname: string
    keywords: string | null
    objective: string | null
    path: string
    tokens_saved?: number
    url: string
    user_agent?: string
  },
): string {
  const id = crypto.randomUUID()
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf
  const db = getDb()
  waitUntil(
    db
      .insertInto('request')
      .values({
        city: (cf?.city as string) ?? null,
        country: cf?.country ?? null,
        hostname: params.hostname,
        id,
        keywords: params.keywords,
        objective: params.objective,
        path: params.path,
        tokens_saved: params.tokens_saved ?? null,
        url: params.url,
        user_agent: request.headers.get('user-agent') ?? params.user_agent,
      })
      .execute()
      .then(() => {
        if (params.tokens_saved) env.KV.delete('stats:tokens_saved')
      })
      .catch(() => {}),
  )
  return id
}
