import { expect, test } from 'vitest'
import {
  generateCliCommandsSection,
  parseHelpCommands,
  readCliGuide,
  replaceCliCommandsSection,
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
  expect(section).toContain('| `url`    | URL to fetch |')
  expect(section).toContain(
    '| `--fresh, -f`              | Force fresh fetch (bypass cache)       |',
  )
  expect(section).toContain('```sh')
  expect(section).toContain('$ curl.md example.com')
  expect(section).toContain('$ curl.md example.com --fresh')
  expect(section).toContain('### `auth`')
  expect(section).toContain('| `login`  | Log in with curl.md         |')
  expect(section).toContain('### `org`')
  expect(section).toContain('#### `invite`')
  expect(section).toContain('| `accept` | Accept organization invite      |')
  expect(section).toContain('### `update`')
  expect(section).toContain('| `--target <string>` | Update to specific version |')
  expect(section).not.toContain('### `curl.md auth`')
  expect(section).not.toContain('#### `curl.md org invite`')
})

test('docs CLI commands section matches generated output', async () => {
  const source = readCliGuide()
  const generated = await generateCliCommandsSection()

  expect(replaceCliCommandsSection(source, generated)).toBe(source)
})
