import fs from 'node:fs/promises'
import path from 'node:path'

console.log('Syncing Claude plugin manifests.')

const pluginRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(pluginRoot, '../..')

const packageJsonPath = path.join(pluginRoot, 'package.json')
const pluginJsonPath = path.join(pluginRoot, '.claude-plugin', 'plugin.json')
const repoMarketplaceJsonPath = path.join(repoRoot, '.claude-plugin', 'marketplace.json')
const hostedMarketplaceJsonPath = path.join(repoRoot, 'public', 'claude.json')

const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
  license?: string
  name: string
  repository?:
    | string
    | {
        directory?: string
        url: string
      }
  version: string
}

const repository = formatRepositoryUrl(packageJson.repository)

const pluginManifest = {
  author: {
    name: 'curl.md',
  },
  description: 'URL to markdown for Claude',
  homepage: 'https://curl.md/docs/plugins/claude',
  license: packageJson.license,
  name: 'curl-md',
  repository,
  userConfig: {
    webfetch_redirect: {
      default: true,
      description: "Redirect Claude's built-in WebFetch tool and tell Claude to retry with curl_md",
      title: 'Redirect WebFetch to curl_md',
      type: 'boolean',
    },
  },
  version: packageJson.version,
} satisfies PluginManifest

const repoMarketplaceManifest = {
  name: pluginManifest.name,
  owner: pluginManifest.author,
  plugins: [
    {
      author: pluginManifest.author,
      description: pluginManifest.description,
      homepage: pluginManifest.homepage,
      license: pluginManifest.license,
      name: pluginManifest.name,
      repository: pluginManifest.repository,
      source: {
        package: packageJson.name,
        source: 'npm',
        version: packageJson.version,
      },
      version: packageJson.version,
    },
  ],
} satisfies MarketplaceManifest

const hostedMarketplaceManifest = {
  name: pluginManifest.name,
  owner: pluginManifest.author,
  plugins: [
    {
      author: pluginManifest.author,
      description: pluginManifest.description,
      homepage: pluginManifest.homepage,
      license: pluginManifest.license,
      name: pluginManifest.name,
      repository: pluginManifest.repository,
      source: {
        package: packageJson.name,
        source: 'npm',
        version: packageJson.version,
      },
      version: packageJson.version,
    },
  ],
} satisfies MarketplaceManifest

await fs.mkdir(path.dirname(pluginJsonPath), { recursive: true })
await fs.mkdir(path.dirname(repoMarketplaceJsonPath), { recursive: true })

await fs.writeFile(pluginJsonPath, `${JSON.stringify(pluginManifest, undefined, 2)}\n`, 'utf8')
await fs.writeFile(
  repoMarketplaceJsonPath,
  `${JSON.stringify(repoMarketplaceManifest, undefined, 2)}\n`,
  'utf8',
)
await fs.writeFile(
  hostedMarketplaceJsonPath,
  `${JSON.stringify(hostedMarketplaceManifest, undefined, 2)}\n`,
  'utf8',
)

console.log('Done.')

type PluginManifest = {
  author?: {
    email?: string | undefined
    name: string
  }
  description: string
  homepage?: string | undefined
  license?: string | undefined
  name: string
  repository?: string | undefined
  userConfig?: Record<string, unknown>
  version: string
}

type MarketplaceManifest = {
  name: string
  owner: NonNullable<PluginManifest['author']>
  plugins: Array<{
    author: NonNullable<PluginManifest['author']>
    description: string
    homepage?: string | undefined
    license?: string | undefined
    name: string
    repository?: string | undefined
    source:
      | string
      | {
          package: string
          source: 'npm'
          version?: string
        }
    version: string
  }>
}

function formatRepositoryUrl(
  packageRepository: string | { directory?: string; url: string } | undefined,
) {
  if (!packageRepository) return undefined

  const repositoryUrl =
    typeof packageRepository === 'string' ? packageRepository : packageRepository.url
  const repositoryDirectory =
    typeof packageRepository === 'string' ? undefined : packageRepository.directory
  const normalizedRepositoryUrl = repositoryUrl
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')

  if (!repositoryDirectory) return normalizedRepositoryUrl
  return `${normalizedRepositoryUrl}/tree/main/${repositoryDirectory}`
}
