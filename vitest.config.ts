import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '#lib/core': existsSync('pro')
              ? new URL('./pro/', import.meta.url).pathname
              : new URL('./src/lib/basic/', import.meta.url).pathname,
            '#': new URL('./src/', import.meta.url).pathname,
          },
        },
        test: {
          name: 'app',
          include: ['src/**/*.test.ts', 'pro/**/*.test.ts'],
          root: path.resolve(import.meta.dirname),
        },
      },
      {
        test: {
          name: 'cli',
          include: ['cli/src/**/*.test.ts'],
          globalSetup: ['cli/global-setup.ts'],
          root: path.resolve(import.meta.dirname),
          testTimeout: 30_000,
        },
      },
    ],
  },
})
