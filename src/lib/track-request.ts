import { waitUntil } from 'cloudflare:workers'
import { getDb } from '#lib/db.ts'

export function trackRequest(
  request: Request,
  params: {
    hostname: string
    path: string
    query: string | null
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
        path: params.path,
        query: params.query,
        tokens_saved: params.tokens_saved ?? null,
        url: params.url,
        user_agent: request.headers.get('user-agent') ?? params.user_agent,
      })
      .execute()
      .catch(() => {}),
  )
  return id
}
