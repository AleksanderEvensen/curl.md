import fs from 'node:fs/promises'

// Restores pkg/package.json from backup.

const packagePath = 'pkg/package.json'
const tmpPath = `${packagePath}.tmp`

console.log('Restoring package.json.')

const packageJson = JSON.parse(await fs.readFile(tmpPath, 'utf-8')) as {
  name?: string | undefined
}

console.log(`${packageJson.name} — cli`)

await fs.writeFile(
  packagePath,
  `${JSON.stringify(packageJson, undefined, 2)}\n`,
  'utf-8',
)
await fs.rm(tmpPath)

console.log('Done.')
