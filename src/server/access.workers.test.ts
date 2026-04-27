import { env } from 'cloudflare:workers'
import { afterAll, describe, expect, test } from 'vitest'
import { createClient } from '#db/client.ts'
import * as Cookie from '#lib/cookie.ts'
import { getSessionAccountId, requireEntityAdmin, requireEntityRead } from '#server/access.ts'
import { createFactory } from '#test/factory.ts'

const db = createClient(env.DB.connectionString, { max: 1 })
const factory = createFactory(db)

afterAll(() => db.destroy())

describe('getSessionAccountId', () => {
  test('ignores stale signed session cookies', async () => {
    const request = new Request('https://curl.local/', {
      headers: { cookie: await getSignedCookieHeader(crypto.randomUUID()) },
    })

    await expect(getSessionAccountId(request, db)).resolves.toBeNull()
  })
})

describe('requireEntityRead', () => {
  test('rejects cross-account access', async () => {
    const account = await factory.account.insert({})
    const otherAccount = await factory.account.insert({})

    await expect(requireEntityRead(db, 'account', otherAccount.id, account.id)).rejects.toThrow(
      'Insufficient permissions',
    )
  })

  test('allows org members and rejects non-members', async () => {
    const account = await factory.account.insert({})
    const organization = await factory.organization.insert({})

    await expect(
      requireEntityRead(db, 'organization', organization.id, account.id),
    ).rejects.toThrow('Insufficient permissions')

    await factory.organization_member.insert({
      account_id: account.id,
      organization_id: organization.id,
      role: 'member',
    })

    await expect(
      requireEntityRead(db, 'organization', organization.id, account.id),
    ).resolves.toEqual({
      id: organization.id,
      type: 'organization',
    })
  })
})

describe('requireEntityAdmin', () => {
  test('rejects org members without admin access', async () => {
    const account = await factory.account.insert({})
    const organization = await factory.organization.insert({})

    await factory.organization_member.insert({
      account_id: account.id,
      organization_id: organization.id,
      role: 'member',
    })

    await expect(
      requireEntityAdmin(db, 'organization', organization.id, account.id),
    ).rejects.toThrow('Insufficient permissions')
  })

  test('allows account self-access and org owners', async () => {
    const account = await factory.account.insert({})
    const organization = await factory.organization.insert({})

    await expect(requireEntityAdmin(db, 'account', account.id, account.id)).resolves.toEqual({
      id: account.id,
      type: 'account',
    })

    await factory.organization_member.insert({
      account_id: account.id,
      organization_id: organization.id,
      role: 'owner',
    })

    await expect(
      requireEntityAdmin(db, 'organization', organization.id, account.id),
    ).resolves.toEqual({
      id: organization.id,
      type: 'organization',
    })
  })
})

async function getSignedCookieHeader(sessionId: string) {
  const headerValue = await Cookie.generateSigned('curl.session', sessionId, env.COOKIE_SECRET)
  return decodeURIComponent(headerValue.split(';')[0]!.split('=').slice(1).join('='))
    ? `curl.session=${decodeURIComponent(headerValue.split(';')[0]!.split('=').slice(1).join('='))}`
    : ''
}
