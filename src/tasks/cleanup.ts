import { getDb } from '#lib/db.ts'

export async function cleanupExpired(env: Env, _ctx: ExecutionContext) {
  const db = getDb(env.DB.connectionString, { max: 1 })
  try {
    await Promise.all([
      db
        .deleteFrom('device_code')
        .where('expires_at', '<', new Date())
        .execute(),
      db.deleteFrom('session').where('expires_at', '<', new Date()).execute(),
    ])
  } finally {
    await db.destroy()
  }
}
