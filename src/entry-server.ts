import { env } from 'cloudflare:workers'
import handler from '@tanstack/react-start/server-entry'
import { getDb } from '#lib/db.ts'

export default {
  fetch(request, env, ctx) {
    return handler.fetch(request, { context: { ctx, env, request } })
  },
  queue: async (batch) => {
    const db = getDb()
    for (const message of batch.messages) {
      const { markdownLength, requestId, url } = message.body
      try {
        const res = await fetch(url, {
          headers: {
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': `Mozilla/5.0 (compatible; ${env.HOST}/1.0; +https://${env.HOST})`,
          },
          redirect: 'follow',
        })
        if (!res.ok) {
          message.ack()
          continue
        }
        const html = await res.text()
        const tokensSaved = Math.round((html.length - markdownLength) / 4)
        await db
          .updateTable('request')
          .set({ tokens_saved: tokensSaved })
          .where('id', '=', requestId)
          .execute()
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
} satisfies ExportedHandler<
  Env,
  Parameters<Env['TOKEN_UPDATE_QUEUE']['send']>[0]
>

declare module '@tanstack/react-start' {
  interface Register {
    server: {
      requestContext: {
        ctx: ExecutionContext
        env: Env
        request: Request
      }
    }
  }
}
