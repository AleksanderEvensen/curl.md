import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { createClient } from '#db/client.ts'
import * as Cookie from '#lib/cookie.ts'

export const getHasSessionCookie = createServerFn({ method: 'GET' }).handler(async () => {
  return Boolean(await getSessionId())
})

export const getSessionLogin = createServerFn({ method: 'GET' }).handler(async () => {
  const sessionId = await getSessionId()
  if (!sessionId) return null

  const db = createClient(env.DB.connectionString)
  const accountId = sessionId
    ? ((
        await db
          .selectFrom('session')
          .where('id', '=', sessionId)
          .where('expires_at', '>', new Date())
          .select('account_id')
          .executeTakeFirst()
      )?.account_id ?? null)
    : null
  if (!accountId) return null

  const account = await db
    .selectFrom('account')
    .where('id', '=', accountId)
    .select('login')
    .executeTakeFirst()

  return account?.login ?? null
})

async function getSessionId() {
  const request = getRequest()

  return Cookie.parseSigned(request.headers.get('cookie') ?? '', env.COOKIE_SECRET, 'curl.session')
}
