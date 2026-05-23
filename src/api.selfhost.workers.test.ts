import { env } from 'cloudflare:workers'
import { expect, test, vi } from 'vitest'
import { api } from '#api.ts'

const selfhostEnv = { ...env, SELFHOST_API_KEY: 'selfhost_test_key' }
const executionCtx = {
  waitUntil: vi.fn((p: Promise<unknown>) => p),
  passThroughOnException: vi.fn(),
  props: {},
}

test('selfhost mode rejects invalid bearer token', async () => {
  const res = await api.fetch(
    new Request('https://curl.local/api/auth/me', {
      headers: { authorization: 'Bearer wrong' },
    }),
    selfhostEnv,
    executionCtx,
  )

  expect(res.status).toBe(401)
  await expect(res.json()).resolves.toEqual({ code: 'invalid_api_key', message: 'Invalid API key' })
})

test('selfhost mode returns static auth account', async () => {
  const res = await api.fetch(
    new Request('https://curl.local/api/auth/me', {
      headers: { authorization: 'Bearer selfhost_test_key' },
    }),
    selfhostEnv,
    executionCtx,
  )

  expect(res.status).toBe(200)
  await expect(res.json()).resolves.toMatchObject({
    account: { id: 'selfhost', login: 'selfhost', organizations: [] },
  })
})

test('selfhost mode returns empty organizations', async () => {
  const res = await api.fetch(
    new Request('https://curl.local/api/orgs', {
      headers: { authorization: 'Bearer selfhost_test_key' },
    }),
    selfhostEnv,
    executionCtx,
  )

  expect(res.status).toBe(200)
  await expect(res.json()).resolves.toEqual({ organizations: [] })
})

test('selfhost mode disables objective extraction', async () => {
  const res = await api.fetch(
    new Request('https://curl.local/api/https%3A%2F%2Fexample.com?q=install', {
      headers: { authorization: 'Bearer selfhost_test_key' },
    }),
    selfhostEnv,
    executionCtx,
  )

  expect(res.status).toBe(400)
  await expect(res.json()).resolves.toEqual({
    code: 'ai_disabled',
    message: 'AI objective extraction is disabled in self-hosted mode',
  })
})
