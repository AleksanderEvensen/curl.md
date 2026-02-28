import { fetchMock } from 'cloudflare:test'
import { afterEach, beforeAll } from 'vitest'

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
  return () => fetchMock.deactivate()
})

afterEach(() => {
  fetchMock.assertNoPendingInterceptors()
})
