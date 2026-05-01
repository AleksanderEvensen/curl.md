import type * as vite from 'vite'
import { createClient } from '#db/client.ts'
import { requestTokensSavedSumSql } from '#db/utils.ts'

export function initialTokensSaved(): vite.Plugin {
  return {
    name: 'initialTokensSaved',
    async config() {
      const tokensSaved = await (async () => {
        try {
          const dbUrl = new URL(process.env.DB_URL ?? '')
          dbUrl.searchParams.delete('sslrootcert')
          const db = createClient(dbUrl.toString(), { max: 1 })
          const result = await db
            .selectFrom('request')
            .select(requestTokensSavedSumSql().as('total'))
            .executeTakeFirst()
          await db.destroy()
          return String(result?.total ?? 0)
        } catch {
          return '0'
        }
      })()
      return {
        define: {
          __INITIAL_TOKENS_SAVED__: tokensSaved,
        },
      }
    },
  }
}
