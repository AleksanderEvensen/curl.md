import { expect, test } from 'vitest'
import {
  generateCliCommandsSection,
  generateCliIntegrationsSection,
  parseHelpCommands,
  parseHelpIntegrations,
  readCliGuide,
  replaceCliCommandsSection,
  replaceCliIntegrationsSection,
} from './cliCommands.ts'

test('parseHelpCommands reads only the Commands section', () => {
  expect(
    parseHelpCommands(`curl.md org — Manage organizations

Usage: curl.md org <command>

Commands:
  create  Create organization
  invite  Manage organization invites (accept, create, list, revoke)
  list    List organizations

Integrations:
  completions  Generate shell completion script
`),
  ).toEqual([
    { description: 'Create organization', name: 'create' },
    {
      description: 'Manage organization invites (accept, create, list, revoke)',
      name: 'invite',
    },
    { description: 'List organizations', name: 'list' },
  ])
})

test('parseHelpIntegrations reads only the Integrations section', () => {
  expect(
    parseHelpIntegrations(`curl.md@x.y.z — URL to markdown for agents

Usage: curl.md <url> [options]

Commands:
  auth  Authenticate with curl.md

Integrations:
  completions  Generate shell completion script
  mcp add      Register as MCP server
  skills       Sync skill files to agents (add, list)

Global Options:
  --help  Show help
`),
  ).toEqual([
    { description: 'Generate shell completion script', name: 'completions' },
    { description: 'Register as MCP server', name: 'mcp add' },
    { description: 'Sync skill files to agents (add, list)', name: 'skills' },
  ])
})

test('generateCliCommandsSection renders nested short headings from help output', async () => {
  const helpByPath = new Map(
    Object.entries({
      '': `curl.md@x.y.z — URL to markdown for agents

Usage: curl.md <url> [options]

Arguments:
  url  URL to fetch

Options:
  --fresh, -f               Force fresh fetch (bypass cache)
  --objective, -o <string>  Narrow content to a specific objective

Examples:
  curl.md example.com
  curl.md example.com --fresh

Commands:
  auth     Authenticate with curl.md (login, logout, status)
  org      Manage organizations (create, invite, list)
  update   Update curl.md CLI

Integrations:
  completions  Generate shell completion script
  mcp add      Register as MCP server
  skills       Sync skill files to agents (add, list)
`,
      auth: `curl.md auth — Authenticate with curl.md (login, logout, status)

Commands:
  login   Log in with curl.md
  logout  Log out of the curl.md CLI
  status  Check authentication status
`,
      'auth login': `curl.md auth login — Log in with curl.md
`,
      'auth logout': `curl.md auth logout — Log out of the curl.md CLI
`,
      'auth status': `curl.md auth status — Check authentication status
`,
      org: `curl.md org — Manage organizations (create, invite, list)

Commands:
  create  Create organization
  invite  Manage organization invites (accept, create)
  list    List organizations
`,
      'org create': `curl.md org create — Create organization
`,
      'org invite': `curl.md org invite — Manage organization invites (accept, create)

Commands:
  accept  Accept organization invite
  create  Create organization invite link
`,
      'org invite accept': `curl.md org invite accept — Accept organization invite
`,
      'org invite create': `curl.md org invite create — Create organization invite link
`,
      'org list': `curl.md org list — List organizations
`,
      update: `curl.md update — Update curl.md CLI

Options:
  --target <string>  Update to specific version
`,
      completions: `curl.md completions — Generate shell completion script

Usage: curl.md completions <bash|fish|nushell|zsh>

Arguments:
  shell  Shell to generate completions for
`,
      'mcp add': `curl.md mcp add — Register as MCP server

Usage: curl.md mcp add [options]

Options:
  --agent <string>  Target a specific agent
`,
      skills: `curl.md skills — Sync skill files to agents

Commands:
  add   Sync skill files to agents
  list  List skills
`,
      'skills add': `curl.md skills add — Sync skill files to agents

Usage: curl.md skills add [options]

Options:
  --no-global  Install to project instead of globally
`,
      'skills list': `curl.md skills list — List skills
`,
    }),
  )

  const section = await generateCliCommandsSection({
    getHelp(path) {
      const help = helpByPath.get(path.join(' '))
      if (!help) throw new Error(`Missing help for ${path.join(' ') || 'root'}.`)
      return Promise.resolve(help)
    },
  })

  expect(section).toContain('### `curl.md <url>`')
  expect(section).toContain('| `url`    | `url` | URL to fetch |')
  expect(section).toContain(
    '| `--fresh, -f`     | `boolean` | Force fresh fetch (bypass cache)       |',
  )
  expect(section).toContain('```sh')
  expect(section).toContain('$ curl.md example.com')
  expect(section).toContain('$ curl.md example.com --fresh')
  expect(section).toContain('### `auth`')
  expect(section).toContain('| [`login`](#auth-login)')
  expect(section).toContain('### `org`')
  expect(section).toContain('#### `invite`')
  expect(section).toContain('| [`accept`](#org-invite-accept)')
  expect(section).toContain('### `update`')
  expect(section).toContain('| `--target` | `string` | Update to specific version |')
  expect(section).not.toContain('## Integrations')
  expect(section).not.toContain('### Integrations')
  expect(section).not.toContain('### `completions`')
  expect(section).not.toContain('### `mcp add`')
  expect(section).not.toContain('### `skills`')
  expect(section).not.toContain('$ curl.md skills add [options]')
  expect(section).not.toContain('Install to project instead of globally')
  expect(section).not.toContain('Target a specific agent')
  expect(section).not.toContain('Shell to generate completions for')
  expect(section).not.toContain('### `curl.md auth`')
  expect(section).not.toContain('#### `curl.md org invite`')
})

test('generateCliIntegrationsSection renders built-in integrations from help output', async () => {
  const helpByPath = new Map(
    Object.entries({
      '': `curl.md@x.y.z — URL to markdown for agents

Usage: curl.md <url> [options]

Commands:
  auth     Authenticate with curl.md (login, logout, status)

Integrations:
  completions  Generate shell completion script
  mcp add      Register as MCP server
  skills       Sync skill files to agents (add, list)
`,
      auth: `curl.md auth — Authenticate with curl.md (login, logout, status)
`,
      completions: `curl.md completions — Generate shell completion script

Usage: curl.md completions <bash|fish|nushell|zsh>

Arguments:
  shell  Shell to generate completions for
`,
      'mcp add': `curl.md mcp add — Register as MCP server

Usage: curl.md mcp add [options]

Options:
  --agent <string>  Target a specific agent
`,
      skills: `curl.md skills — Sync skill files to agents

Commands:
  add   Sync skill files to agents
  list  List skills
`,
      'skills add': `curl.md skills add — Sync skill files to agents

Usage: curl.md skills add [options]

Options:
  --no-global  Install to project instead of globally
`,
      'skills list': `curl.md skills list — List skills
`,
    }),
  )

  const section = await generateCliIntegrationsSection({
    getHelp(path) {
      const help = helpByPath.get(path.join(' '))
      if (!help) throw new Error(`Missing help for ${path.join(' ') || 'root'}.`)
      return Promise.resolve(help)
    },
  })

  expect(section).toContain('### `completions`')
  expect(section).toContain('$ curl.md completions <bash|fish|nushell|zsh>')
  expect(section).toContain('Shell to generate completions for')
  expect(section).toContain('### `mcp add`')
  expect(section).toContain('$ curl.md mcp add [options]')
  expect(section).toContain('Target a specific agent')
  expect(section).toContain('### `skills`')
  expect(section).toContain('| [`add`](#skills-add)')
  expect(section).toContain('#### `add`')
  expect(section).toContain('$ curl.md skills add [options]')
  expect(section).toContain('Install to project instead of globally')
  expect(section).not.toContain('### `auth`')
})

test('docs CLI commands section matches generated output', async () => {
  const source = readCliGuide()
  const generated = await generateCliCommandsSection()

  expect(replaceCliCommandsSection(source, generated)).toBe(source)
})

test('docs CLI integrations section matches generated output', async () => {
  const source = readCliGuide()
  const generated = await generateCliIntegrationsSection()

  expect(replaceCliIntegrationsSection(source, generated)).toBe(source)
})
