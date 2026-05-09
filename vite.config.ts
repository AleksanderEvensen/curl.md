import * as child from 'node:child_process'
import * as path from 'node:path'
import { defineConfig, lazyPlugins, loadEnv } from 'vite-plus'

const isCheck = ['check', 'fmt', 'lint'].includes(process.env.VP_COMMAND ?? '')
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')

export default defineConfig({
  define: !isCheck
    ? await (async () => {
        const { getWranglerVar } = await import('#config/wrangler.ts')
        const host = getWranglerVar('HOST')
        const environment = (() => {
          if (host === 'curl.local') return 'development'
          if (host === 'curl.md') return 'production'
          return 'preview'
        })()
        return {
          __ENV__: JSON.stringify(environment),
          __GIT_SHA__: JSON.stringify(
            process.env.GIT_SHA ??
              (() => {
                try {
                  return child.execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim()
                } catch {
                  return 'dev'
                }
              })(),
          ),
          __HOST__: JSON.stringify(host),
          __ORIGIN__: process.env.PLAYWRIGHT
            ? `(typeof window !== 'undefined' ? window.location.origin : 'https://${host}')`
            : JSON.stringify(`https://${host}`),
          __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN ?? ''),
        }
      })()
    : {},
  fmt: {
    ignorePatterns: [
      '**/dist',
      '**/__fixtures__',
      '**/__snapshots__',
      '**/worker-configuration.d.ts',
      'src/md/rules/__fixtures__/**',
      'src/md/rules/__snapshots__/**',
      'src/routeTree.gen.ts',
    ],
    semi: false,
    singleQuote: true,
    sortImports: {
      internalPattern: ['#*'],
      newlinesBetween: false,
    },
    sortPackageJson: false,
    sortTailwindcss: {},
  },
  lint: {
    categories: {
      correctness: 'error',
    },
    ignorePatterns: [
      '**/dist',
      '**/dist-types',
      '**/__fixtures__',
      '**/__snapshots__',
      '**/worker-configuration.d.ts',
      'dist/**',
      'dist-types/**',
      'public/docs/**',
      'src/routeTree.gen.ts',
    ],
    overrides: [
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        rules: {
          'no-lone-blocks': 'off',
          'typescript/no-non-null-assertion': 'off',
        },
      },
    ],
    rules: {
      'typescript/no-floating-promises': 'error',
    },
  },
  server: {
    allowedHosts: ['curl.local'],
  },
  staged: {
    '*': 'vp check --fix --no-error-on-unmatched-pattern',
    '*.{ts,tsx}': "bash -c 'pnpm check:types'",
  },
  plugins: lazyPlugins(async () => {
    const autoImport = await import('unplugin-auto-import/vite')
    const icons = await import('unplugin-icons/vite')
    const iconsResolver = await import('unplugin-icons/resolver')
    const tailwindcss = await import('@tailwindcss/vite')
    const viteReact = await import('@vitejs/plugin-react')
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    const { FileSystemIconLoader } = await import('unplugin-icons/loaders')
    const { initialTokensSaved } = await import('#config/vite.ts')
    const { sentryTanstackStart } = await import('@sentry/tanstackstart-react/vite')
    const { tanstackStart } = await import('@tanstack/react-start/plugin/vite')
    const { cloudflareDevWorkarounds } = await import('#config/wrangler.ts')

    const { docs } = await import('#config/docs/vite.ts')
    const { Env } = await import('./test/env.ts')

    return [
      initialTokensSaved(),
      tailwindcss.default(),
      cloudflareDevWorkarounds(),
      cloudflare({
        viteEnvironment: { name: 'ssr' },
        // Override bindings for tests (testcontainers DB, emulate GitHub)
        ...(process.env.PLAYWRIGHT || process.env.VITEST
          ? {
              ...(process.env.PLAYWRIGHT ? { inspectorPort: false } : {}),
              remoteBindings: false,
              config(config) {
                const parsed = Env.parse(process.env)
                const DB_URL = parsed.DB_URL
                config.hyperdrive = config.hyperdrive?.map((h) => ({
                  ...h,
                  localConnectionString: DB_URL,
                }))
                config.vars = { ...config.vars, ...parsed }
                // Clear secrets so they're passed as plain vars (Vite plugin drops secret_text bindings)
                delete config.secrets
              },
            }
          : {}),
      }),
      icons.default({
        compiler: 'jsx',
        customCollections: {
          brand: FileSystemIconLoader(path.resolve(import.meta.dirname, 'config/icons/brand')),
        },
        jsx: 'react',
      }),
      autoImport.default({
        dts: 'src/auto-imports.d.ts',
        include: [/\.[jt]sx?$/, /\.[jt]sx?\?tsr-/],
        resolvers: [
          iconsResolver.default({
            prefix: 'Icon',
            extension: 'jsx',
            alias: { octicon: 'octicon', 'simple-icons': 'simple-icons' },
            customCollections: ['brand'],
          }),
        ],
      }),
      tanstackStart(),
      docs(),
      viteReact.default(),
      sentryTanstackStart({
        ...(env.SENTRY_AUTH_TOKEN ? { authToken: env.SENTRY_AUTH_TOKEN } : {}),
        org: env.SENTRY_ORG || 'wevm',
        project: env.SENTRY_PROJECT || 'curl_md',
        release: {
          name:
            process.env.GIT_SHA ??
            (() => {
              try {
                return child.execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim()
              } catch {
                return 'dev'
              }
            })(),
        },
        telemetry: false,
      }),
    ]
  }) as never,
})
