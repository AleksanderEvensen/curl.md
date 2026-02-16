import * as child from 'node:child_process'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { getWranglerVar } from './config/wrangler.ts'

export default defineConfig({
  server: {
    allowedHosts: ['curl.local'],
  },
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
  define: {
    __GIT_SHA__: JSON.stringify(
      (() => {
        try {
          return child
            .execSync('git rev-parse --short HEAD', { stdio: 'pipe' })
            .toString()
            .trim()
        } catch {
          return 'dev'
        }
      })(),
    ),
    __HOST__: JSON.stringify(getWranglerVar('HOST')),
  },
})
