import * as child from 'node:child_process'
import path from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import autoImport from 'unplugin-auto-import/vite'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import iconsResolver from 'unplugin-icons/resolver'
import icons from 'unplugin-icons/vite'
import { defineConfig, loadEnv } from 'vite'
import { docs } from '#config/docs/vite.ts'
import { initialTokensSaved } from '#config/vite.ts'
import { cloudflareDevWorkarounds, getWranglerVar } from '#config/wrangler.ts'
import { Env } from './test/env.ts'

export default defineConfig((config) => {
  const env = loadEnv(config.mode, process.cwd(), '')
  const gitSha =
    process.env.GIT_SHA ??
    (() => {
      try {
        return child.execSync('git rev-parse HEAD', { stdio: 'pipe' }).toString().trim()
      } catch {
        return 'dev'
      }
    })()
  const host = getWranglerVar('HOST')
  const sentryEnvironment = (() => {
    if (host === 'curl.local') return 'development'
    if (host === 'curl.md') return 'production'
    return 'preview'
  })()

  return {
    server: {
      allowedHosts: ['curl.local'],
    },
    plugins: [
      initialTokensSaved(),
      tailwindcss(),
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
      icons({
        compiler: 'jsx',
        customCollections: {
          brand: FileSystemIconLoader(path.resolve(import.meta.dirname, 'config/icons/brand')),
        },
        jsx: 'react',
      }),
      autoImport({
        dts: 'src/auto-imports.d.ts',
        include: [/\.[jt]sx?$/, /\.[jt]sx?\?tsr-/],
        resolvers: [
          iconsResolver({
            prefix: 'Icon',
            extension: 'jsx',
            alias: { octicon: 'octicon', 'simple-icons': 'simple-icons' },
            customCollections: ['brand'],
          }),
        ],
      }),
      tanstackStart(),
      docs(),
      viteReact(),
      sentryTanstackStart({
        ...(env.SENTRY_AUTH_TOKEN ? { authToken: env.SENTRY_AUTH_TOKEN } : {}),
        org: env.SENTRY_ORG || 'wevm',
        project: env.SENTRY_PROJECT || 'curl_md',
        release: { name: gitSha },
        telemetry: false,
      }),
    ],
    define: {
      __ENV__: JSON.stringify(sentryEnvironment),
      __GIT_SHA__: JSON.stringify(gitSha),
      __HOST__: JSON.stringify(host),
      __ORIGIN__: process.env.PLAYWRIGHT
        ? `(typeof window !== 'undefined' ? window.location.origin : 'https://${host}')`
        : JSON.stringify(`https://${host}`),
      __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN ?? ''),
    },
  }
})
