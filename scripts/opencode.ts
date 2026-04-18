import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

console.log('Launching opencode plugin.')

const root = path.resolve(import.meta.dirname, '..')
const opencodeBinPath = path.join(
  root,
  'plugins',
  'opencode',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'opencode.cmd' : 'opencode',
)
const pluginsDir = path.join(root, '.opencode', 'plugins')
const shimPath = path.join(pluginsDir, 'curlmd.ts')
const pluginSourcePath = path.join(root, 'plugins', 'opencode', 'server.ts')
const importPath = path.relative(pluginsDir, pluginSourcePath).split(path.sep).join('/')
const projectTuiConfigPath = path.join(root, 'tui.json')
const tempTuiConfigDir = mkdtempSync(path.join(os.tmpdir(), 'curlmd-opencode-'))
const tempTuiConfigPath = path.join(tempTuiConfigDir, 'tui.json')
const tuiPluginPath = pathToFileURL(path.join(root, 'plugins', 'opencode', 'tui.ts')).href

mkdirSync(pluginsDir, { recursive: true })
writeFileSync(shimPath, `export { plugin } from ${JSON.stringify(importPath)}\n`)
writeFileSync(tempTuiConfigPath, `${JSON.stringify(buildTuiConfig(), null, 2)}\n`)

try {
  execFileSync(opencodeBinPath, process.argv.slice(2), {
    cwd: root,
    env: {
      ...process.env,
      CURLMD_BASE_URL: process.env.CURLMD_BASE_URL || 'https://curl.local',
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
      OPENCODE_TUI_CONFIG: tempTuiConfigPath,
    },
    stdio: 'inherit',
  })
} finally {
  rmSync(tempTuiConfigDir, { force: true, recursive: true })
}

console.log('Done.')

function buildTuiConfig() {
  const config = readJsonFile(projectTuiConfigPath)
  const plugin = Array.isArray(config?.plugin) ? [...config.plugin] : []

  if (!plugin.includes(tuiPluginPath)) plugin.push(tuiPluginPath)

  if (!config)
    return {
      $schema: 'https://opencode.ai/tui.json',
      plugin,
    }

  return {
    ...config,
    $schema: 'https://opencode.ai/tui.json',
    plugin,
  }
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}
