import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const cliCommandsStart = '{/* GENERATED:cli-commands:start */}'
export const cliCommandsEnd = '{/* GENERATED:cli-commands:end */}'

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const cliGuidePath = path.join(process.cwd(), 'docs/guide/cli.mdx')
const cliSourceDirectoryPath = path.join(process.cwd(), 'cli', 'src')

type CliCommandNode = {
  arguments?: CliHelpEntry[]
  children?: CliCommandNode[]
  description: string
  examples?: string[]
  name: string
  options?: CliHelpEntry[]
  path: string[]
}

type CliHelpEntry = {
  description: string
  name: string
}

type CliRootCommand = {
  arguments: CliHelpEntry[]
  description: string
  examples: string[]
  options: CliHelpEntry[]
  usage: string
}

type CliModule = {
  default: {
    serve: (
      args: string[],
      options: {
        env: Record<string, string>
        exit: (code: number) => void
        stdout: (text: string) => void
      },
    ) => Promise<unknown>
  }
}

export async function generateCliCommandsSection(
  props: {
    getHelp?: (path: string[]) => Promise<string>
  } = {},
) {
  const getHelp = props.getHelp ?? readCliHelp
  const rootHelp = await getHelp([])
  const rootCommand = parseRootCommand(rootHelp)
  const tree = await buildCliCommandTree(getHelp, rootHelp)
  return renderCliCommandNodes(tree, rootCommand)
}

export function replaceCliCommandsSection(source: string, content: string) {
  const start = source.indexOf(cliCommandsStart)
  const end = source.indexOf(cliCommandsEnd)

  if (start === -1 || end === -1 || end < start)
    throw new Error('Missing CLI commands markers in docs/guide/cli.mdx.')

  const before = source.slice(0, start + cliCommandsStart.length)
  const after = source.slice(end)
  return `${before}\n\n${content}\n\n${after}`
}

export function isCliGuideSyncPath(filePath: string) {
  const resolvedPath = path.resolve(filePath)
  return (
    resolvedPath === cliGuidePath || resolvedPath.startsWith(`${cliSourceDirectoryPath}${path.sep}`)
  )
}

export async function syncCliGuide() {
  const source = readCliGuide()
  const content = await generateCliCommandsSection()
  const next = replaceCliCommandsSection(source, content)
  if (next === source) return false

  writeFileSync(cliGuidePath, next)
  return true
}

export async function readCliHelp(commandPath: string[]) {
  const { default: cli } = await loadCli()

  let exitCode: number | undefined
  let output = ''
  const args = [...commandPath, '--help']
  const originalArgv = process.argv
  process.argv = [...originalArgv.slice(0, 2), ...args]

  try {
    await cli.serve(args, {
      env: { CURLMD_BASE_URL: 'https://curl.md' },
      exit(code: number) {
        exitCode = code
      },
      stdout(text: string) {
        output += text
      },
    })
  } finally {
    process.argv = originalArgv
  }

  if (exitCode && exitCode !== 0)
    throw new Error(`Failed to read CLI help for ${commandPath.join(' ') || 'root'}.`)

  return output.replace(ansiPattern, '')
}

export function parseHelpCommands(help: string) {
  return parseHelpEntries(help, 'Commands')
}

function parseHelpEntries(help: string, section: string) {
  const lines = help.split(/\r?\n/)
  const start = lines.indexOf(`${section}:`)
  if (start === -1) return []

  const commands = [] as CliHelpEntry[]
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) break
    const match = line.match(/^\s{2}(.+?)\s{2,}(.*)$/)
    if (!match) continue
    const description = match[2]
    const name = match[1]
    if (!description || !name) continue
    commands.push({
      description: description.trim(),
      name: name.trim(),
    })
  }

  return commands
}

function parseHelpExamples(help: string) {
  const lines = help.split(/\r?\n/)
  const start = lines.indexOf('Examples:')
  if (start === -1) return []

  const examples: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) break
    const match = line.match(/^\s{2}(.*)$/)
    if (!match?.[1]) continue
    examples.push(match[1])
  }

  return examples
}

function parseRootCommand(help: string): CliRootCommand | null {
  const description = help.split(/\r?\n/, 1)[0]?.split('—').slice(1).join('—').trim()
  const usage = help
    .split(/\r?\n/)
    .find((line) => line.startsWith('Usage: '))
    ?.slice('Usage: '.length)
    .replace(/\s+\[options\]$/, '')
    .trim()

  if (!description || !usage) return null

  return {
    arguments: parseHelpEntries(help, 'Arguments'),
    description,
    examples: parseHelpExamples(help),
    options: parseHelpEntries(help, 'Options'),
    usage,
  }
}

async function buildCliCommandTree(
  getHelp: (path: string[]) => Promise<string>,
  rootHelp?: string,
) {
  const cache = new Map<string, Promise<string>>()

  async function read(path: string[]) {
    const key = path.join(' ')
    const cached = cache.get(key)
    if (cached) return cached

    const result = getHelp(path)
    cache.set(key, result)
    return result
  }

  async function visit(path: string[], help?: string): Promise<CliCommandNode[]> {
    const output = help ?? (await read(path))
    const commands = parseHelpCommands(output)

    return Promise.all(
      commands.map(async (command) => {
        const nextPath = [...path, command.name]
        const nextHelp = await read(nextPath)
        const children = await visit(nextPath, nextHelp)

        return {
          ...(parseHelpEntries(nextHelp, 'Arguments').length
            ? { arguments: parseHelpEntries(nextHelp, 'Arguments') }
            : {}),
          description: command.description,
          ...(parseHelpExamples(nextHelp).length ? { examples: parseHelpExamples(nextHelp) } : {}),
          name: command.name,
          ...(parseHelpEntries(nextHelp, 'Options').length
            ? { options: parseHelpEntries(nextHelp, 'Options') }
            : {}),
          path: nextPath,
          ...(children.length ? { children } : {}),
        }
      }),
    )
  }

  return visit([], rootHelp)
}

function renderCliCommandNodes(nodes: CliCommandNode[], rootCommand: CliRootCommand | null) {
  const lines: string[] = []

  if (rootCommand) lines.push(...renderRootCommand(rootCommand))

  for (const node of nodes) {
    if (lines.length) lines.push('')
    lines.push(...renderCliCommandNode(node, 3))
  }

  return lines.join('\n')
}

function renderRootCommand(rootCommand: CliRootCommand): string[] {
  const lines = [`### \`${rootCommand.usage}\``, '', rootCommand.description]

  if (rootCommand.arguments.length) {
    lines.push(
      '',
      ...renderTable(
        ['Argument', 'Description'],
        rootCommand.arguments.map((entry) => [
          `\`${escapeTableCell(entry.name)}\``,
          escapeTableCell(entry.description),
        ]),
      ),
    )
  }

  if (rootCommand.options.length) {
    lines.push(
      '',
      ...renderTable(
        ['Option', 'Description'],
        rootCommand.options.map((entry) => [
          `\`${escapeTableCell(entry.name)}\``,
          escapeTableCell(entry.description),
        ]),
      ),
    )
  }

  if (rootCommand.examples.length) lines.push('', ...renderExamples(rootCommand.examples))

  return lines
}

function renderCliCommandNode(node: CliCommandNode, depth: number): string[] {
  const lines = [`${'#'.repeat(depth)} \`${node.name}\``, '', node.description]
  const leafChildren = node.children?.filter((child) => !child.children?.length) ?? []
  const groupChildren = node.children?.filter((child) => child.children?.length) ?? []

  if (!node.children?.length) {
    if (node.arguments?.length) {
      lines.push(
        '',
        ...renderTable(
          ['Argument', 'Description'],
          node.arguments.map((entry) => [
            `\`${escapeTableCell(entry.name)}\``,
            escapeTableCell(entry.description),
          ]),
        ),
      )
    }

    if (node.options?.length) {
      lines.push(
        '',
        ...renderTable(
          ['Option', 'Description'],
          node.options.map((entry) => [
            `\`${escapeTableCell(entry.name)}\``,
            escapeTableCell(entry.description),
          ]),
        ),
      )
    }

    if (node.examples?.length) lines.push('', ...renderExamples(node.examples))

    return lines
  }

  if (leafChildren.length) {
    lines.push(
      '',
      ...renderTable(
        ['Command', 'Description'],
        leafChildren.map((child) => [
          `\`${escapeTableCell(child.name)}\``,
          escapeTableCell(child.description),
        ]),
      ),
    )
  }

  for (const child of groupChildren) {
    lines.push('', ...renderCliCommandNode(child, depth + 1))
  }

  return lines
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, '\\|')
}

function renderTable(header: [string, string], rows: Array<[string, string]>) {
  const firstColumnWidth = Math.max(header[0].length, ...rows.map(([value]) => value.length))
  const secondColumnWidth = Math.max(header[1].length, ...rows.map(([, value]) => value.length))

  return [
    `| ${header[0].padEnd(firstColumnWidth)} | ${header[1].padEnd(secondColumnWidth)} |`,
    `| ${'-'.repeat(firstColumnWidth)} | ${'-'.repeat(secondColumnWidth)} |`,
    ...rows.map(
      ([first, second]) =>
        `| ${first.padEnd(firstColumnWidth)} | ${second.padEnd(secondColumnWidth)} |`,
    ),
  ]
}

function renderExamples(examples: string[]) {
  return ['```sh', ...examples.map((example) => `$ ${example}`), '```']
}

let cliPromise: Promise<CliModule> | undefined

function loadCli() {
  cliPromise ??= import(['..', '..', 'cli', 'src', 'cli.ts'].join('/')) as Promise<CliModule>
  return cliPromise
}

export function readCliGuide() {
  return readFileSync(cliGuidePath, 'utf8')
}
