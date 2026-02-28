import { Kysely } from 'kysely'
import { z } from 'zod'
import { dialect } from '../src/lib/pg.ts'

const env = z.parse(z.object({ DB_URL: z.string() }), process.env)
const db = new Kysely<{
  request: { tokens_saved: number | null }
}>({ dialect: dialect(env.DB_URL) })

const result = await db
  .selectFrom('request')
  .select((eb) => eb.fn.sum<number>('tokens_saved').as('total'))
  .executeTakeFirst()

process.stdout.write(String(result?.total ?? 0))
process.exit()
