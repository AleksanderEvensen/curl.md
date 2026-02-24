import { execFileSync } from 'node:child_process'

export function setup() {
  execFileSync('pnpm', ['build:cli'], {
    cwd: `${import.meta.dirname}/..`,
    stdio: 'inherit',
  })
}
