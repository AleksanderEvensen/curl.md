import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const cliCommandsStart = '{/* GENERATED:cli-commands:start */}'
export const cliCommandsEnd = '{/* GENERATED:cli-commands:end */}'
export const cliIntegrationsStart = '{/* GENERATED:cli-integrations:start */}'
export const cliIntegrationsEnd = '{/* GENERATED:cli-integrations:end */}'
export const cliEnvironmentVariablesStart = '{/* GENERATED:cli-environment-variables:start */}'
export const cliEnvironmentVariablesEnd = '{/* GENERATED:cli-environment-variables:end */}'

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
const cliGuidePath = path.join(process.cwd(), 'docs/guide/cli.mdx')
const cliSourceDirectoryPath = path.join(process.cwd(), 'cli', 'src')

type CliCommandNode = {
  aliases?: string[]
  arguments?: CliHelpEntry[]
  children?: CliCommandNode[]
  description: string
  examples?: string[]
  name: string
  options?: CliHelpEntry[]
  path: string[]
  section: 'command' | 'integration'
  usage?: string
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
  return renderCliCommandNodes(
    tree.filter((node) => node.section === 'command'),
    rootCommand,
  )
}

export async function generateCliIntegrationsSection(
  props: {
    getHelp?: (path: string[]) => Promise<string>
  } = {},
) {
  const getHelp = props.getHelp ?? readCliHelp
  const rootHelp = await getHelp([])
  const tree = await buildCliCommandTree(getHelp, rootHelp)
  return renderCliCommandNodes(
    tree.filter((node) => node.section === 'integration'),
    null,
  )
}

export async function generateCliEnvironmentVariablesSection(
  props: {
    getHelp?: (path: string[]) => Promise<string>
  } = {},
) {
  const getHelp = props.getHelp ?? readCliHelp
  const rootHelp = await getHelp([])
  const environmentVariables = parseHelpEntries(rootHelp, 'Environment Variables')
  return renderEnvironmentVariablesTable(environmentVariables).join('\n')
}

export function replaceCliCommandsSection(source: string, content: string) {
  return replaceCliGuideSection(source, cliCommandsStart, cliCommandsEnd, content)
}

export function replaceCliIntegrationsSection(source: string, content: string) {
  return replaceCliGuideSection(source, cliIntegrationsStart, cliIntegrationsEnd, content)
}

export function replaceCliEnvironmentVariablesSection(source: string, content: string) {
  return replaceCliGuideSection(
    source,
    cliEnvironmentVariablesStart,
    cliEnvironmentVariablesEnd,
    content,
  )
}

function replaceCliGuideSection(
  source: string,
  startMarker: string,
  endMarker: string,
  content: string,
) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)

  if (start === -1 || end === -1 || end < start)
    throw new Error(`Missing CLI guide markers for ${startMarker} in docs/guide/cli.mdx.`)

  const before = source.slice(0, start + startMarker.length)
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
  const commandsContent = await generateCliCommandsSection()
  const nextCommands = replaceCliCommandsSection(source, commandsContent)
  const integrationsContent = await generateCliIntegrationsSection()
  const nextIntegrations = replaceCliIntegrationsSection(nextCommands, integrationsContent)
  const environmentVariablesContent = await generateCliEnvironmentVariablesSection()
  const next = replaceCliEnvironmentVariablesSection(nextIntegrations, environmentVariablesContent)
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

export function parseHelpIntegrations(help: string) {
  return parseHelpEntries(help, 'Integrations')
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

function parseHelpAliases(help: string) {
  const aliases = help
    .split(/\r?\n/)
    .find((line) => line.startsWith('Aliases: '))
    ?.slice('Aliases: '.length)
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)

  return aliases ?? []
}

function parseRootCommand(help: string): CliRootCommand | null {
  const description = help.split(/\r?\n/, 1)[0]?.split('—').slice(1).join('—').trim()
  const usage = parseHelpUsage(help)?.replace(/\s+\[options\]$/, '')

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
    const commands = [
      ...parseHelpCommands(output).map((command) => ({ ...command, section: 'command' as const })),
      ...parseHelpIntegrations(output).map((command) => ({
        ...command,
        section: 'integration' as const,
      })),
    ]

    return Promise.all(
      commands.map(async (command) => {
        const nextPath = [...path, ...parseCommandPath(command.name)]
        const nextHelp = await read(nextPath)
        const children = await visit(nextPath, nextHelp)
        const aliases = parseHelpAliases(nextHelp)
        const usage = parseHelpUsage(nextHelp)

        return {
          ...(aliases.length ? { aliases } : {}),
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
          section: command.section,
          ...(usage ? { usage } : {}),
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
    lines.push('', ...renderArgumentsTable(rootCommand.arguments, rootCommand.usage))
  }

  if (rootCommand.options.length) {
    lines.push('', ...renderOptionsTable(rootCommand.options))
  }

  if (rootCommand.examples.length) lines.push('', ...renderExamples(rootCommand.examples))

  return lines
}

function renderCliCommandNode(node: CliCommandNode, depth: number): string[] {
  const lines = [renderAnchor(node), `${'#'.repeat(depth)} \`${node.name}\``, '', node.description]
  const children = node.children ?? []

  if (!children.length) {
    if (node.usage) lines.push('', ...renderExamples([node.usage]))

    if (node.arguments?.length) {
      lines.push('', ...renderArgumentsTable(node.arguments, node.usage))
    }

    if (node.options?.length) {
      lines.push('', ...renderOptionsTable(node.options))
    }

    if (node.examples?.length) lines.push('', ...renderExamples(node.examples))

    return lines
  }

  if (children.length) {
    lines.push(
      '',
      ...renderTable(
        ['Command', 'Description'],
        children.map((child) => [renderCommandLabel(child), escapeTableCell(child.description)]),
      ),
    )
  }

  for (const child of children) {
    lines.push('', ...renderCliCommandNode(child, depth + 1))
  }

  return lines
}

function getCommandAnchorId(node: CliCommandNode) {
  return node.path.join('-')
}

function renderCommandLink(node: CliCommandNode) {
  return `[\`${escapeTableCell(node.name)}\`](#${getCommandAnchorId(node)})`
}

function renderCommandLabel(node: CliCommandNode) {
  const aliases = node.aliases?.map((alias) => `\`${escapeTableCell(alias)}\``)
  if (!aliases?.length) return renderCommandLink(node)
  return `${renderCommandLink(node)}, ${aliases.join(', ')}`
}

function renderAnchor(node: CliCommandNode) {
  return `<a id="${getCommandAnchorId(node)}"></a>`
}

function parseHelpUsage(help: string) {
  return help
    .split(/\r?\n/)
    .find((line) => line.startsWith('Usage: '))
    ?.slice('Usage: '.length)
    .trim()
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, '\\|')
}

function renderOptionsTable(options: CliHelpEntry[]) {
  const parsedOptions = options.map((option) => parseOptionEntry(option))
  const showDefaultColumn = parsedOptions.some((option) => option.defaultValue)

  return renderTable(
    showDefaultColumn
      ? ['Option', 'Type', 'Default', 'Description']
      : ['Option', 'Type', 'Description'],
    parsedOptions.map((option) => {
      const row = [
        `\`${escapeTableCell(option.option)}\``,
        option.type ? `\`${escapeTableCell(option.type)}\`` : '',
      ]

      if (showDefaultColumn) {
        row.push(option.defaultValue ? `\`${escapeTableCell(option.defaultValue)}\`` : '')
      }

      row.push(escapeTableCell(option.description))
      return row
    }),
  )
}

function renderArgumentsTable(arguments_: CliHelpEntry[], usage: string | undefined) {
  const argumentTypes = parseUsageArgumentTypes(usage)

  return renderTable(
    ['Argument', 'Type', 'Description'],
    arguments_.map((argument, index) => [
      `\`${escapeTableCell(argument.name)}\``,
      argumentTypes[index] ? `\`${escapeTableCell(argumentTypes[index])}\`` : '',
      escapeTableCell(argument.description),
    ]),
  )
}

function parseOptionEntry(option: CliHelpEntry) {
  const match = option.name.match(/^(.*?)(?: <([^>]+)>)?$/)
  const descriptionMatch = option.description.match(/^(.*?)(?: \(default: ([^)]+)\))?$/)

  return {
    defaultValue: descriptionMatch?.[2],
    description: descriptionMatch?.[1]?.trim() || option.description,
    option: match?.[1]?.trim() || option.name,
    type: match?.[2] ?? 'boolean',
  }
}

function parseUsageArgumentTypes(usage: string | undefined) {
  if (!usage) return []

  const matches = [...usage.matchAll(/<([^>]+)>|\[([^\]]+)\]/g)]
  return matches
    .map((match) => match[1] ?? match[2] ?? '')
    .filter((value) => value && value !== 'options')
}

function parseCommandPath(commandName: string) {
  return commandName.split(' ').filter(Boolean)
}

function renderEnvironmentVariablesTable(environmentVariables: CliHelpEntry[]) {
  return renderTable(
    ['Variable', 'Type', 'Default', 'Description'],
    environmentVariables.map((environmentVariable) => {
      const parsed = parseEnvironmentVariableEntry(environmentVariable)
      return [
        `\`${escapeTableCell(parsed.name)}\``,
        '`string`',
        parsed.defaultValue ? `\`${escapeTableCell(parsed.defaultValue)}\`` : '',
        escapeTableCell(parsed.description),
      ]
    }),
  )
}

function parseEnvironmentVariableEntry(environmentVariable: CliHelpEntry) {
  const metadata = environmentVariable.description.match(/\(([^)]*)\)$/)?.[1]
  const defaultValue = metadata?.match(/(?:^|, )default: (.*)$/)?.[1]
  const description = metadata
    ? environmentVariable.description
        .slice(0, environmentVariable.description.lastIndexOf(' ('))
        .trim()
    : environmentVariable.description

  return {
    defaultValue,
    description,
    name: environmentVariable.name,
  }
}

function renderTable(header: string[], rows: string[][]) {
  const columnWidths = header.map((heading, index) =>
    Math.max(heading.length, ...rows.map((row) => row[index]?.length ?? 0)),
  )

  return [
    `| ${header.map((heading, index) => heading.padEnd(columnWidths[index] ?? heading.length)).join(' | ')} |`,
    `| ${columnWidths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(
      (row) =>
        `| ${row.map((cell, index) => cell.padEnd(columnWidths[index] ?? cell.length)).join(' | ')} |`,
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
