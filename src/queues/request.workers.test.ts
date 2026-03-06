import { createMessageBatch, env, fetchMock } from 'cloudflare:test'
import { estimateTokenCount } from 'tokenx'
import { afterEach, beforeAll, expect, test } from 'vitest'
import { getDb } from '#lib/db.ts'
import * as Nanoid from '#lib/nanoid.ts'
import { processRequestMessage } from '#queues/request.ts'
import { createFactory } from '../../test/factory.ts'

const db = getDb(env.DB.connectionString)
const factory = createFactory(db)

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
  return () => fetchMock.deactivate()
})

afterEach(() => {
  fetchMock.assertNoPendingInterceptors()
})

test('inserts request record', async () => {
  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: null,
          api_key_id: null,
          billable: false,
          cost_mills: 0,
          estimated: false,
          hostname: 'example.com',
          id: 'req_1',
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/',
          tokens_saved: null,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const row = await db
    .selectFrom('request')
    .where('id', '=', 'req_1')
    .selectAll()
    .executeTakeFirstOrThrow()
  expect(row.hostname).toBe('example.com')
  expect(row.url).toBe('https://example.com')
  expect(row.path).toBe('/')
  expect(row.user_agent).toBe('test-agent')
})

test('updates tokens_saved when estimated', async () => {
  const html = `<html><body>${'x'.repeat(1000)}</body></html>`
  fetchMock
    .get('https://example.com')
    .intercept({ path: '/page' })
    .reply(200, html, { headers: { 'content-type': 'text/html' } })

  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: null,
          api_key_id: null,
          billable: false,
          cost_mills: 0,
          estimated: true,
          hostname: 'example.com',
          id: 'req_2',
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/page',
          tokens_saved: 500,
          url: 'https://example.com/page',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const row = await db
    .selectFrom('request')
    .where('id', '=', 'req_2')
    .selectAll()
    .executeTakeFirstOrThrow()
  const expectedTokensSaved = estimateTokenCount(html) - 25
  expect(row.tokens_saved).toBe(expectedTokensSaved)
})

test('clears KV cache when tokens_saved is set', async () => {
  await env.KV.put('stats:tokens_saved', '1000')

  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: null,
          api_key_id: null,
          billable: false,
          cost_mills: 0,
          estimated: false,
          hostname: 'example.com',
          id: 'req_3',
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/',
          tokens_saved: 500,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const cached = await env.KV.get('stats:tokens_saved')
  expect(cached).toBeNull()
})

test('skips tokens_saved update when fetch fails', async () => {
  fetchMock
    .get('https://example.com')
    .intercept({ path: '/fail' })
    .reply(500, 'error')

  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: null,
          api_key_id: null,
          billable: false,
          cost_mills: 0,
          estimated: true,
          hostname: 'example.com',
          id: 'req_4',
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/fail',
          tokens_saved: 42,
          url: 'https://example.com/fail',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const row = await db
    .selectFrom('request')
    .where('id', '=', 'req_4')
    .selectAll()
    .executeTakeFirstOrThrow()
  expect(row.tokens_saved).toBe(42)
})

test('deducts credits when billable', async () => {
  const account = await factory.account.insert({})
  await db
    .updateTable('account')
    .set({ balance_mills: 10000 })
    .where('id', '=', account.id)
    .execute()

  const requestId = Nanoid.generate()
  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: account.id,
          api_key_id: null,
          billable: true,
          cost_mills: 10,
          estimated: false,
          hostname: 'example.com',
          id: requestId,
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/',
          tokens_saved: null,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const updated = await db
    .selectFrom('account')
    .where('id', '=', account.id)
    .select('balance_mills')
    .executeTakeFirstOrThrow()
  expect(updated.balance_mills).toBe(9990)

  const tx = await db
    .selectFrom('credit_transaction')
    .where('reference_id', '=', requestId)
    .selectAll()
    .executeTakeFirstOrThrow()
  expect(tx.type).toBe('request')
  expect(tx.amount_mills).toBe(-10)
  expect(tx.balance_after_mills).toBe(9990)
})

test('deducts credits for organization', async () => {
  const org = await factory.organization.insert({})
  await db
    .updateTable('organization')
    .set({ balance_mills: 5000 })
    .where('id', '=', org.id)
    .execute()

  const requestId = Nanoid.generate()
  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: null,
          api_key_id: null,
          billable: true,
          cost_mills: 30,
          estimated: false,
          hostname: 'example.com',
          id: requestId,
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: org.id,
          path: '/',
          tokens_saved: null,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const updated = await db
    .selectFrom('organization')
    .where('id', '=', org.id)
    .select('balance_mills')
    .executeTakeFirstOrThrow()
  expect(updated.balance_mills).toBe(4970)
})

test('does not create negative balance', async () => {
  const account = await factory.account.insert({})
  await db
    .updateTable('account')
    .set({ balance_mills: 10 })
    .where('id', '=', account.id)
    .execute()

  const requestId = Nanoid.generate()
  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: account.id,
          api_key_id: null,
          billable: true,
          cost_mills: 30,
          estimated: false,
          hostname: 'example.com',
          id: requestId,
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/',
          tokens_saved: null,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const updated = await db
    .selectFrom('account')
    .where('id', '=', account.id)
    .select('balance_mills')
    .executeTakeFirstOrThrow()
  expect(updated.balance_mills).toBe(10)

  const tx = await db
    .selectFrom('credit_transaction')
    .where('reference_id', '=', requestId)
    .selectAll()
    .executeTakeFirst()
  expect(tx).toBeUndefined()
})

test('skips deduction when not billable', async () => {
  const account = await factory.account.insert({})
  await db
    .updateTable('account')
    .set({ balance_mills: 10000 })
    .where('id', '=', account.id)
    .execute()

  const requestId = Nanoid.generate()
  const batch = createMessageBatch<processRequestMessage.Body>(
    processRequestMessage.queueName,
    [
      {
        attempts: 1,
        body: {
          account_id: account.id,
          api_key_id: null,
          billable: false,
          cost_mills: 1,
          estimated: false,
          hostname: 'example.com',
          id: requestId,
          keywords: null,
          markdownTokens: 25,
          objective: null,
          organization_id: null,
          path: '/',
          tokens_saved: null,
          url: 'https://example.com',
          user_agent: 'test-agent',
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
    ],
  )
  await processRequestMessage(batch.messages[0]!, db)

  const updated = await db
    .selectFrom('account')
    .where('id', '=', account.id)
    .select('balance_mills')
    .executeTakeFirstOrThrow()
  expect(updated.balance_mills).toBe(10000)
})

test('deducts credits only once for same request', async () => {
  const account = await factory.account.insert({})
  await db
    .updateTable('account')
    .set({ balance_mills: 10000 })
    .where('id', '=', account.id)
    .execute()

  const requestId = Nanoid.generate()
  const makeMessage = () =>
    createMessageBatch<processRequestMessage.Body>(
      processRequestMessage.queueName,
      [
        {
          attempts: 1,
          body: {
            account_id: account.id,
            api_key_id: null,
            billable: true,
            cost_mills: 30,
            estimated: false,
            hostname: 'example.com',
            id: requestId,
            keywords: null,
            markdownTokens: 25,
            objective: null,
            organization_id: null,
            path: '/',
            tokens_saved: null,
            url: 'https://example.com',
            user_agent: 'test-agent',
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ],
    )

  // Process first time
  await processRequestMessage(makeMessage().messages[0]!, db)

  // Process second time — idempotent insert is skipped via onConflict
  await processRequestMessage(makeMessage().messages[0]!, db)

  const updated = await db
    .selectFrom('account')
    .where('id', '=', account.id)
    .select('balance_mills')
    .executeTakeFirstOrThrow()
  expect(updated.balance_mills).toBe(9970)

  const txns = await db
    .selectFrom('credit_transaction')
    .where('reference_id', '=', requestId)
    .where('type', '=', 'request')
    .selectAll()
    .execute()
  expect(txns).toHaveLength(1)
  expect(txns[0]!.amount_mills).toBe(-30)
})
