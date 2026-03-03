import { hc } from 'hono/client'
import { Cli, middleware, z } from 'incur'
import type { api } from '../../src/api.ts'
import pkg from '../package.json' with { type: 'json' }
import { pc } from './picocolors.ts'
import {
  type Command,
  compareVersions,
  createSpinner,
  fetchLatestVersion,
  installGlobal,
  openUrl,
  relativeTime,
  Session,
  select,
  UpdateCache,
} from './utils.ts'

const vars = z.object({
  client: z.custom<ReturnType<typeof hc<typeof api>>>(),
  commands: z.custom<Command[]>(),
  session: z.custom<Session.Data | null>(),
})

const cli = Cli.create('curl.md', {
  description: 'Fetch any web page and convert it to markdown.',
  version: pkg.version,
  env: z.object({
    CURL_MD_BASE_URL: z
      .string()
      .default('https://curl.md')
      .describe('Base URL'),
  }),
  vars,
  usage: [{ suffix: '<url> [options]' }],
  args: z.object({
    url: z.string().describe('URL to fetch'),
  }),
  options: z.object({
    fresh: z.boolean().optional().describe('Force fresh fetch (bypass cache)'),
    keywords: z
      .array(z.string())
      .optional()
      .describe('Pre-filter by keywords (comma-separated)'),
    objective: z
      .string()
      .optional()
      .describe('Narrow content to a specific objective'),
  }),
  alias: { fresh: 'f', keywords: 'k', objective: 'q' },
  examples: [
    { args: { url: 'example.com' } },
    {
      args: {
        url: 'docs.github.com/en/webhooks/webhook-events-and-payloads',
      },
      options: {
        objective: 'pull request webhook event payload and actions',
        keywords: ['pull_request'],
      },
    },
    {
      args: {
        url: 'developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
      },
      options: {
        objective: 'streaming response body',
        keywords: ['ReadableStream,getReader'],
      },
    },
    {
      args: { url: 'developers.cloudflare.com/d1/get-started' },
      options: {
        objective: 'how to query D1 from a worker',
        keywords: ['D1,bindings'],
      },
    },
    {
      args: { url: 'ai-sdk.dev/docs/ai-sdk-core/generating-text' },
      options: {
        objective: 'how to stream text with the ai sdk',
        keywords: ['streamText,generateText'],
      },
    },
  ],
  output: z.string().describe('Page content as markdown'),
  format: 'md',
  async run(c) {
    const url = c.args.url

    const result = z.safeParse(
      z
        .string()
        .transform((arg) => (arg.includes('://') ? arg : `https://${arg}`))
        .pipe(
          z.url({
            hostname: z.regexes.domain,
            normalize: true,
            protocol: /^https?$/,
          }),
        ),
      url,
    )
    if (!result.success)
      return c.error({
        code: 'INVALID_URL',
        message: `Invalid URL: ${url}`,
        cta: {
          description: 'URL must be a valid HTTP(S) address:',
          commands: [
            {
              command: c.name,
              args: { url: 'example.com' },
              description: 'Domain without protocol',
            },
            {
              command: c.name,
              args: { url: 'https://example.com/path' },
              description: 'Full URL with protocol',
            },
            ...c.var.commands,
          ],
        },
      })

    const keywords = c.options.keywords?.flatMap((k: string) => k.split(','))
    const res = await c.var.client.api[':url{.+}'].$get({
      param: { url: url },
      query: {
        fresh: c.options.fresh ? '' : undefined,
        k: keywords?.join(','),
        q: c.options.objective,
      },
    })
    const text = await res.text()

    if (!res.ok) return c.error({ code: 'FETCH_FAILED', message: text })

    if (!c.options.objective)
      return c.ok(text, {
        cta: {
          description: 'Narrow results with an objective:',
          commands: [
            {
              command: c.name,
              args: { url },
              options: { objective: true },
              description: 'Focus on a specific topic',
            },
            ...c.var.commands,
          ],
        },
      })

    return c.ok(text, {
      cta: { commands: c.var.commands },
    })
  },
})

cli.use(async (c, next) => {
  const session = Session.read()
  c.set('session', session)
  const headers: Record<string, string> = {}
  if (session) {
    headers.Authorization = `Bearer ${session.session_id}`
    if (session.organization_id)
      headers['x-organization-id'] = session.organization_id
  }
  c.set('client', hc<typeof api>(c.env.CURL_MD_BASE_URL, { headers }))
  return next()
})

// Non-blocking update check: read cache from a previous run, spawn background
// refresh if stale, set commands var for CTA — never blocks on network.
const staleMs = 1000 * 60 * 60 // 1 hour
cli.use((c, next) => {
  const cache = UpdateCache.read()
  const stale = !cache || Date.now() - cache.checked_at > staleMs
  if (stale) UpdateCache.spawnCheck()

  const commands = c.var.commands ?? []
  if (cache && compareVersions(cache.latest, pkg.version) > 0) {
    let description = `Update available: ${pkg.version} → ${cache.latest}`
    if (cache.released_at) {
      const ago = relativeTime(new Date(cache.released_at))
      if (ago) description += ` (released ${ago})`
    }
    commands.push({ command: `${c.name} update`, description })
  }
  c.set('commands', commands)

  return next()
})

const requireAuth = middleware<typeof vars>((c, next) => {
  if (!c.var.session)
    return c.error({
      ...notAuthenticated,
      cta: {
        description: 'Log in:',
        commands: [
          {
            command: `${c.name} auth login`,
            description: `Authenticate with ${c.name}`,
          },
          ...c.var.commands,
        ],
      },
    })
  return next()
})
const notAuthenticated = {
  code: 'NOT_AUTHENTICATED',
  message: 'You are not authenticated.',
}

const auth = Cli.create('auth', {
  description: 'Authentication commands',
  vars,
})
  .command('check', {
    description: 'Check if you are authenticated',
    middleware: [requireAuth],
    output: z.string(),
    format: 'md',
    async run(c) {
      const res = await c.var.client.api.auth.me.$get()
      const data = await res.json()
      if (!data.account) {
        Session.delete()
        return c.error({
          ...notAuthenticated,
          cta: {
            description: 'Log in:',
            commands: [
              {
                command: `${c.name} auth login`,
                description: `Authenticate with ${c.name}`,
              },
              ...c.var.commands,
            ],
          },
        })
      }
      return 'You are authenticated.'
    },
  })
  .command('login', {
    description: 'Authenticate with the curl.md API',
    output: z.string(),
    format: 'md',
    async run(c) {
      if (c.var.session) {
        const res = await c.var.client.api.auth.me.$get()
        const data = await res.json()
        if (data.account)
          return c.error({
            code: 'ALREADY_LOGGED_IN',
            message: 'You are already authenticated.',
          })
      }

      const deviceRes = await c.var.client.api.auth.device.$post()
      const device = await deviceRes.json()

      const url = `${device.verification_uri}?user_code=${device.user_code}`
      openUrl(url)

      console.log(
        `\n${pc.bold('Confirmation Code:')} ${pc.green(device.user_code)}\n`,
      )
      console.log(
        `If something goes wrong, copy and paste this URL into your browser:\n${pc.bold(url)}\n`,
      )

      const spinner = createSpinner('Waiting for authentication...')
      const interval = (device.interval ?? 5) * 1000
      try {
        while (true) {
          const tokenRes = await c.var.client.api.auth.device.token.$post({
            json: { code: device.code },
          })
          const tokenData = await tokenRes.json()
          if ('error' in tokenData) {
            if (tokenData.error === 'authorization_pending') {
              await new Promise((r) => setTimeout(r, interval))
              continue
            }
            spinner.stop()
            return c.error({ code: 'AUTH_FAILED', message: tokenData.error })
          }
          if ('session_id' in tokenData) {
            spinner.stop()
            Session.write({ session_id: tokenData.session_id })
            return 'Successfully logged in.'
          }
        }
      } catch (error) {
        spinner.stop()
        throw error
      }
    },
  })
  .command('logout', {
    description: 'Log out of the curl.md API',
    output: z.string(),
    format: 'md',
    async run(c) {
      if (!c.var.session) return 'Already logged out.'

      await new Promise<void>((resolve) => {
        process.stdout.write(`Press Enter to log out of ${c.name} CLI.`)
        process.stdin.once('data', () => {
          process.stdin.pause()
          resolve()
        })
        process.stdin.resume()
      })

      Session.delete()
      return 'Successfully logged out.'
    },
  })

const org = Cli.create('org', {
  description: 'Create, list, show, switch organizations',
  vars,
})
  .command('create', {
    description: 'Create organization',
    middleware: [requireAuth],
    args: z.object({
      login: z.string().describe('Organization login (e.g. "wevm")'),
    }),
    options: z.object({
      name: z.string().optional().describe('Display name (defaults to login)'),
    }),
    output: z.string(),
    format: 'md',
    async run(c) {
      const res = await c.var.client.api.orgs.$post({
        json: { login: c.args.login, name: c.options.name },
      })
      const data = await res.json()
      if (!res.ok)
        return c.error({
          code: 'CREATE_FAILED',
          message:
            'error' in data ? data.error : 'Failed to create organization.',
        })

      return c.ok(`Created organization ${c.args.login}.`, {
        cta: {
          description: 'Switch to it:',
          commands: [
            {
              command: `${c.name} org switch ${c.args.login}`,
              description: `Switch to ${c.args.login}`,
            },
            ...c.var.commands,
          ],
        },
      })
    },
  })
  .command('list', {
    description: 'List organizations',
    middleware: [requireAuth],
    output: z.string(),
    format: 'md',
    async run(c) {
      const res = await c.var.client.api.orgs.$get()
      const data = await res.json()
      if ('error' in data)
        return c.error({ code: 'FETCH_FAILED', message: data.error })
      // biome-ignore lint/style/noNonNullAssertion: middleware handles
      const activeId = c.var.session!.organization_id

      const lines: string[] = []
      if (activeId) lines.push(`  personal ${pc.dim('(no organization)')}`)
      else lines.push(`${pc.bold('*')} personal ${pc.dim('(no organization)')}`)

      for (const org of data.organizations) {
        if (org.id === activeId) lines.push(`${pc.bold('*')} ${org.login}`)
        else lines.push(`  ${org.login}`)
      }
      return lines.join('\n')
    },
  })
  .command('show', {
    description: 'Show active organization',
    middleware: [requireAuth],
    output: z.string(),
    format: 'md',
    async run(c) {
      // biome-ignore lint/style/noNonNullAssertion: middleware handles
      const orgId = c.var.session!.organization_id
      if (!orgId) return `personal ${pc.dim('(no organization)')}`

      const res = await c.var.client.api.orgs[':id'].$get({
        param: { id: orgId },
      })
      const data = await res.json()
      if ('error' in data)
        return c.error({ code: 'FETCH_FAILED', message: data.error })
      return `${data.organization.login} (${data.organization.name})`
    },
  })
  .command('switch', {
    description: 'Switch active organization',
    middleware: [requireAuth],
    args: z.object({
      login: z
        .string()
        .optional()
        .describe('Organization login to switch to (or "personal")'),
    }),
    output: z.string(),
    format: 'md',
    async run(c) {
      const res = await c.var.client.api.orgs.$get()
      const data = await res.json()
      if ('error' in data)
        return c.error({ code: 'FETCH_FAILED', message: data.error })

      if (c.args.login) {
        if (c.args.login === 'personal') {
          Session.write({ organization_id: undefined })
          return 'Switched to personal (no organization).'
        }
        const match = data.organizations.find((o) => o.login === c.args.login)
        if (!match)
          return c.error({
            code: 'ORG_NOT_FOUND',
            message: `Organization "${c.args.login}" not found.`,
          })
        Session.write({ organization_id: match.id })
        return `Switched to ${match.login}.`
      }

      const choices = [
        { label: `personal ${pc.dim('(no organization)')}`, id: undefined },
        ...data.organizations.map((o) => ({ label: o.login, id: o.id })),
      ]

      const index = await select(
        'Switch to:',
        choices.map((c) => c.label),
      )
      if (index === -1)
        return c.error({
          code: 'INVALID_SELECTION',
          message: 'Selection cancelled.',
        })

      const selected = choices[index]
      if (!selected)
        return c.error({
          code: 'INVALID_SELECTION',
          message: 'Invalid selection.',
        })
      Session.write({ organization_id: selected.id })
      return `Switched to ${selected.id ? selected.label : 'personal (no organization)'}.`
    },
  })

const update = Cli.create('update', {
  description: 'Update curl.md CLI',
  vars,
  options: z.object({
    target: z.string().optional().describe('Update to specific version'),
  }),
  output: z.string(),
  format: 'md',
  async run(c) {
    const version = c.options.target ?? (await fetchLatestVersion('curl.md'))
    if (
      !version.startsWith('http') &&
      compareVersions(version, pkg.version) <= 0
    )
      return `Already up-to-date (${pkg.version}).`
    try {
      await installGlobal(c.name, version)
      return `Updated ${c.name} to ${version}.`
    } catch (error) {
      return c.error({
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Update failed.',
      })
    }
  },
})

cli.command(auth)
cli.command(org)
cli.command(update)

export default cli
