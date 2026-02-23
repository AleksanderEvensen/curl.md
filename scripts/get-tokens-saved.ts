import { execSync } from 'node:child_process'
import path from 'node:path'

const isRemote = process.argv.includes('--remote')
const env = process.argv.includes('--env')
  ? process.argv[process.argv.indexOf('--env') + 1]
  : undefined

const envFlag = env ? `--env ${env}` : ''
const remoteFlag = isRemote ? '--remote' : '--local'
const cmd = `pnpm exec wrangler d1 execute curl-db ${remoteFlag} ${envFlag} --command "SELECT SUM(tokens_saved) as total FROM request" --json`
const output = execSync(cmd, {
  encoding: 'utf-8',
  cwd: path.resolve(import.meta.dirname, '..'),
})
const result = JSON.parse(output)
const total = result[0]?.results?.[0]?.total ?? 0
process.stdout.write(String(total))
