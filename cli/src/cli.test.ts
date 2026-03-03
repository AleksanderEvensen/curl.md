import { hc } from 'hono/client'
import { Kysely } from 'kysely'
import {
  beforeEach,
  describe,
  expect,
  inject,
  onTestFinished,
  test,
  vi,
} from 'vitest'
import type { api } from '#api.ts'
import type { DB } from '#lib/db.gen.ts'
import * as Nanoid from '#lib/nanoid.ts'
import { dialect } from '#lib/pg.ts'
import { Env } from '../../test/env.ts'
import { createFactory } from '../../test/factory.ts'
import * as utils from '../src/utils.ts'
import { Session, UpdateCache } from '../src/utils.ts'
import { serve, useTempHome } from '../test/utils.ts'

const env = Env.parse(inject('env'))
const client = hc<typeof api>(env.CURL_MD_BASE_URL)
const db = new Kysely<DB>({ dialect: dialect(env.DB_URL) })
const factory = createFactory(db)

let home: ReturnType<typeof useTempHome>
beforeEach(() => {
  home = useTempHome()
  return () => home.cleanup()
})

test('prints version', async () => {
  const { output } = await serve(['--version'])
  expect(output).toMatchInlineSnapshot(`
  	"x.y.z
  	"
  `)
})

test('prints help', async () => {
  const { output } = await serve(['--help'])
  expect(output).toMatchInlineSnapshot(`
    "curl.md — Fetch any web page and convert it to markdown.
    vx.y.z

    Usage: curl.md <url> [options]

    Arguments:
      url  URL to fetch

    Options:
      --fresh, -f <boolean>     Force fresh fetch (bypass cache)
      --keywords, -k <array>    Pre-filter by keywords (comma-separated)
      --objective, -q <string>  Narrow content to a specific objective

    Environment Variables:
      CURL_MD_BASE_URL  Base URL (default: https://curl.md)

    Examples:
      $ curl.md example.com
      $ curl.md docs.github.com/en/webhooks/webhook-events-and-payloads --objective pull request webhook event payload and actions --keywords pull_request
      $ curl.md developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch --objective streaming response body --keywords ReadableStream,getReader
      $ curl.md developers.cloudflare.com/d1/get-started --objective how to query D1 from a worker --keywords D1,bindings
      $ curl.md ai-sdk.dev/docs/ai-sdk-core/generating-text --objective how to stream text with the ai sdk --keywords streamText,generateText

    Commands:
      auth    Authentication commands
      org     Create, list, show, switch organizations
      update  Update curl.md CLI

    Built-in Commands:
      mcp add     Register as an MCP server
      skills add  Sync skill files to your agent

    Global Options:
      --format <toon|json|yaml|md|jsonl>  Output format
      --help                              Show help
      --llms                              Print LLM-readable manifest
      --mcp                               Start as MCP stdio server
      --verbose                           Show full output envelope
      --version                           Show version
    "
  `)
})

describe('fetch', () => {
  test('fetches example.com as markdown', async () => {
    const { output } = await serve(['example.com'])
    expect(output).toContain('Example Domain')
  }, 30_000)

  test('fetches example.com as json', async () => {
    const { output } = await serve(['example.com', '--json'])
    const json = JSON.parse(output)
    const content = json.data ?? json.content ?? json
    expect(
      typeof content === 'string' ? content : JSON.stringify(content),
    ).toContain('Example Domain')
  }, 30_000)

  test('exits with error for invalid url', async () => {
    const { exitCode, output } = await serve(['!!!invalid'])
    expect(exitCode).toBe(1)
    expect(output).toMatchInlineSnapshot(`
      "## code

      INVALID_URL

      ## message

      Invalid URL: !!!invalid

      ## cta.description

      URL must be a valid HTTP(S) address:

      ## cta.commands

      | command                          | description             |
      |----------------------------------|-------------------------|
      | curl.md example.com              | Domain without protocol |
      | curl.md https://example.com/path | Full URL with protocol  |
      "
    `)
  })

  test('exits with error for missing url', async () => {
    const { exitCode, output } = await serve([])
    expect(exitCode).toBe(1)
    expect(output).toContain('VALIDATION_ERROR')
  })
})

describe('update check middleware', () => {
  test('no cache spawns background check', async () => {
    const spy = vi.spyOn(UpdateCache, 'spawnCheck').mockImplementation(() => {})
    onTestFinished(() => spy.mockRestore())

    await serve(['auth', 'check'])
    expect(spy).toHaveBeenCalled()
  })

  test('stale cache spawns background check', async () => {
    UpdateCache.write({
      checked_at: Date.now() - 2 * 60 * 60 * 1000,
      latest: '0.0.1',
      released_at: null,
    })
    const spy = vi.spyOn(UpdateCache, 'spawnCheck').mockImplementation(() => {})
    onTestFinished(() => spy.mockRestore())

    await serve(['auth', 'check'])
    expect(spy).toHaveBeenCalled()
  })

  test('fresh cache does not spawn background check', async () => {
    UpdateCache.write({
      checked_at: Date.now(),
      latest: '0.0.1',
      released_at: null,
    })
    const spy = vi.spyOn(UpdateCache, 'spawnCheck').mockImplementation(() => {})
    onTestFinished(() => spy.mockRestore())

    await serve(['auth', 'check'])
    expect(spy).not.toHaveBeenCalled()
  })

  test('adds update command when newer version available', async () => {
    UpdateCache.write({
      checked_at: Date.now(),
      latest: '99.0.0',
      released_at: null,
    })
    const spawnSpy = vi
      .spyOn(UpdateCache, 'spawnCheck')
      .mockImplementation(() => {})
    const compareSpy = vi.spyOn(utils, 'compareVersions').mockReturnValue(1)
    onTestFinished(() => {
      spawnSpy.mockRestore()
      compareSpy.mockRestore()
    })

    const { output } = await serve(['!!!invalid'])
    expect(output).toContain('curl.md update')
    expect(output).toContain('99.0.0')
  })

  test('includes relative time when released_at is set', async () => {
    UpdateCache.write({
      checked_at: Date.now(),
      latest: '99.0.0',
      released_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    })
    const spawnSpy = vi
      .spyOn(UpdateCache, 'spawnCheck')
      .mockImplementation(() => {})
    const compareSpy = vi.spyOn(utils, 'compareVersions').mockReturnValue(1)
    onTestFinished(() => {
      spawnSpy.mockRestore()
      compareSpy.mockRestore()
    })

    const { output } = await serve(['!!!invalid'])
    expect(output).toContain('released 3h ago')
  })

  test('no update command when version is current', async () => {
    UpdateCache.write({
      checked_at: Date.now(),
      latest: '0.0.1',
      released_at: null,
    })
    const spawnSpy = vi
      .spyOn(UpdateCache, 'spawnCheck')
      .mockImplementation(() => {})
    const compareSpy = vi.spyOn(utils, 'compareVersions').mockReturnValue(0)
    onTestFinished(() => {
      spawnSpy.mockRestore()
      compareSpy.mockRestore()
    })

    const { output } = await serve(['!!!invalid'])
    expect(output).not.toContain('curl.md update')
  })
})

describe('auth', () => {
  test('check when not logged in', async () => {
    const { output } = await serve(['auth', 'check'])
    expect(output).toContain('You are not authenticated')
  })

  test('logout when not logged in', async () => {
    const { output } = await serve(['auth', 'logout'])
    expect(output).toContain('Already logged out')
  })

  test('logout deletes session', async () => {
    Session.write({ session_id: 'test' })

    // Simulate pressing Enter
    setTimeout(() => process.stdin.emit('data', '\n'), 100)
    const { output } = await serve(['auth', 'logout'])
    expect(output).toContain('Successfully logged out')
    expect(Session.read()).toBeNull()
  })

  test('check with expired session', async () => {
    Session.write({ session_id: 'expired-session-id' })

    const { output } = await serve(['auth', 'check'])
    expect(output).toContain('You are not authenticated')
    expect(Session.read()).toBeNull()
  })

  test('login full device flow', async () => {
    vi.mock('node:child_process', () => ({
      default: { exec: vi.fn(), spawn: vi.fn(() => ({ unref: vi.fn() })) },
      exec: vi.fn(),
      spawn: vi.fn(() => ({ unref: vi.fn() })),
    }))

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    onTestFinished(() => consoleSpy.mockRestore())

    const account = await factory.account.insert({})
    const session = await factory.session.insert({ account_id: account.id })

    const loginPromise = serve(['auth', 'login'])

    const deviceCode = await vi.waitFor(() =>
      db
        .selectFrom('device_code')
        .where('status', '=', 'pending')
        .select(['user_code', 'id'])
        .orderBy('created_at', 'desc')
        .executeTakeFirstOrThrow(),
    )

    await client.api.auth.device.confirm.$post(
      { json: { user_code: deviceCode.user_code } },
      { headers: { Authorization: `Bearer ${session.id}` } },
    )

    const { output } = await loginPromise
    expect(output).toContain('Successfully logged in')
    expect(Session.read()).not.toBeNull()

    const { output: checkOutput } = await serve(['auth', 'check'])
    expect(checkOutput).toContain('You are authenticated')
  })
})

describe('org', () => {
  test('requires auth when not logged in', async () => {
    const { exitCode, output } = await serve(['org', 'list'])
    expect(exitCode).toBe(1)
    expect(output).toContain('NOT_AUTHENTICATED')
  })

  test('list shows personal when no orgs', async () => {
    const account = await factory.account.insert({})
    const session = await factory.session.insert({ account_id: account.id })
    Session.write({ session_id: session.id })

    const { output } = await serve(['org', 'list'])
    expect(output).toContain('personal')
  })

  test('show defaults to personal', async () => {
    const account = await factory.account.insert({})
    const session = await factory.session.insert({ account_id: account.id })
    Session.write({ session_id: session.id })

    const { output } = await serve(['org', 'show'])
    expect(output).toContain('personal')
  })

  test('create, list, switch, and show', async () => {
    const account = await factory.account.insert({})
    const session = await factory.session.insert({ account_id: account.id })
    Session.write({ session_id: session.id })

    const login = `test-org${Nanoid.generate()}`
    const { output: createOutput } = await serve([
      'org',
      'create',
      login,
      '--name',
      'Test Org',
    ])
    expect(createOutput).toContain(`Created organization ${login}`)

    const { output: listOutput } = await serve(['org', 'list'])
    expect(listOutput).toContain(login)
    expect(listOutput).toContain('personal')

    const { output: switchOutput } = await serve(['org', 'switch', login])
    expect(switchOutput).toContain(`Switched to ${login}`)

    const { output: showOutput } = await serve(['org', 'show'])
    expect(showOutput).toContain(login)

    const { output: switchBackOutput } = await serve([
      'org',
      'switch',
      'personal',
    ])
    expect(switchBackOutput).toContain('Switched to personal')
  })

  test('switch to nonexistent org', async () => {
    const account = await factory.account.insert({})
    const session = await factory.session.insert({ account_id: account.id })
    Session.write({ session_id: session.id })

    const { exitCode, output } = await serve([
      'org',
      'switch',
      'nonexistent-org',
    ])
    expect(exitCode).toBe(1)
    expect(output).toContain('ORG_NOT_FOUND')
  })
})
