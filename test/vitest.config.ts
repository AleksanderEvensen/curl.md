import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#': new URL('../src/', import.meta.url).pathname,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    root: path.resolve(import.meta.dirname, '..'),
  },
})
