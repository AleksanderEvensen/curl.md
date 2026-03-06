import { type Expression, Kysely, sql } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import postgres from 'postgres'
import type { DB } from '#lib/db.gen.ts'

export function getDb(connectionString: string) {
  return new Kysely<DB>({
    dialect: dialect(connectionString),
  })
}

export function dialect(url: string) {
  return new PostgresJSDialect({
    postgres: postgres(url),
  })
}

export function lower(expr: Expression<string | null>) {
  return sql<string>`lower(${expr})`
}

export function nanoid() {
  return sql<string>`nanoid()`
}

export function now() {
  return sql<Date>`now()`
}
