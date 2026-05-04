import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('organization').addColumn('avatar_url', 'varchar(255)').execute()

  await sql`
    UPDATE organization
    SET avatar_url = CASE login
      WHEN 'tempo' THEN 'https://avatars.githubusercontent.com/u/211589300?v=4'
      WHEN 'wevm' THEN 'https://avatars.githubusercontent.com/u/109633172?v=4'
    END
    WHERE login IN ('tempo', 'wevm')
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('organization').dropColumn('avatar_url').execute()
}
