import { vi } from 'vitest'

vi.mock('../package.json', () => ({ default: { version: 'x.y.z' } }))

// Suppress CLI spinner/console output from cluttering test output
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
