import { type Expression, sql } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import postgres from 'postgres'

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
