import { env } from 'cloudflare:workers'
import type { Database } from '#db/client.ts'
import * as Cookie from '#lib/cookie.ts'

export async function getSessionAccountId(request: Request, db: Database) {
  const sessionId = await Cookie.parseSigned(
    request.headers.get('cookie') ?? '',
    env.COOKIE_SECRET,
    'curl.session',
  )
  if (!sessionId) return null

  const session = await db
    .selectFrom('session')
    .where('id', '=', sessionId)
    .where('expires_at', '>', new Date())
    .select('account_id')
    .executeTakeFirst()

  return session?.account_id ?? null
}

export async function requireSession(request: Request, db: Database) {
  const accountId = await getSessionAccountId(request, db)
  if (!accountId) throw new Error('Authentication required')
  return accountId
}

export async function requireEntityRead(
  db: Database,
  entityType: 'account' | 'organization',
  entityId: string,
  accountId: string,
) {
  if (entityType === 'account') {
    if (entityId !== accountId) throw new Error('Insufficient permissions')
    return { id: accountId, type: 'account' as const }
  }

  const member = await db
    .selectFrom('organization_member')
    .innerJoin('organization', 'organization.id', 'organization_member.organization_id')
    .where('organization.id', '=', entityId)
    .where('organization.deleted_at', 'is', null)
    .where('organization_member.account_id', '=', accountId)
    .select('organization_member.id')
    .executeTakeFirst()
  if (!member) throw new Error('Insufficient permissions')

  return { id: entityId, type: 'organization' as const }
}

export async function requireEntityAdmin(
  db: Database,
  entityType: 'account' | 'organization',
  entityId: string,
  accountId: string,
) {
  if (entityType === 'account') {
    if (entityId !== accountId) throw new Error('Insufficient permissions')
    return { id: accountId, type: 'account' as const }
  }

  const member = await db
    .selectFrom('organization_member')
    .innerJoin('organization', 'organization.id', 'organization_member.organization_id')
    .where('organization.id', '=', entityId)
    .where('organization.deleted_at', 'is', null)
    .where('organization_member.account_id', '=', accountId)
    .select('organization_member.role')
    .executeTakeFirst()
  if (!member || (member.role !== 'owner' && member.role !== 'admin'))
    throw new Error('Insufficient permissions')

  return { id: entityId, type: 'organization' as const }
}

export function requireSameOrigin(request: Request) {
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto')
  if (proto) url.protocol = `${proto}:`

  const origin = request.headers.get('origin')
  if (origin) {
    if (origin !== url.origin) throw new Error('Invalid origin')
    return
  }

  const referer = request.headers.get('referer')
  if (!referer) return

  let refererOrigin: string | null = null
  try {
    refererOrigin = new URL(referer).origin
  } catch {
    throw new Error('Invalid origin')
  }
  if (refererOrigin !== url.origin) throw new Error('Invalid origin')
}
