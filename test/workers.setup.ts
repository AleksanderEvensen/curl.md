import process from 'node:process'
import { afterEach, beforeAll } from 'vitest'
import { server } from './workers.server.ts'

// TODO: remove once porsager/postgres fixes CF polyfill read loop teardown (stream cancel after connection close)
// https://github.com/cloudflare/workers-sdk/issues/11532
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error && reason.message === 'Stream was cancelled.') return
  throw reason
})

process.on('uncaughtException', (error) => {
  if (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ECONNRESET' || error.code === 'EPIPE')
  )
    return
  throw error
})

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  return () => {
    server.close()
  }
})
afterEach(() => server.resetHandlers())
