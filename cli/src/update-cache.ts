import fs from 'node:fs'
import { UpdateCache } from './utils.ts'

const res = await fetch('https://registry.npmjs.org/curl.md', {
  headers: { accept: 'application/json' },
  signal: AbortSignal.timeout(5_000),
})
if (!res.ok) process.exit(1)
const pkg = await res.json()
const latest = pkg['dist-tags']?.latest
if (!latest) process.exit(1)
const released_at = pkg.time?.[latest] ?? null
const p = UpdateCache.path()
fs.mkdirSync(new URL('.', `file:///${p}`), { recursive: true })
fs.writeFileSync(
  p,
  JSON.stringify({ latest, released_at, checked_at: Date.now() }),
)
