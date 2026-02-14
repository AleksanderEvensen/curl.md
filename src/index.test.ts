import { describe, expect, it } from 'vitest'
import handler from './index'

const mockEnv = { HOST: 'curl.test' } as unknown as Parameters<
  typeof handler.fetch
>[1]

describe('landing page', () => {
  it('returns markdown for terminal user-agent', async () => {
    const res = await handler.fetch(
      new Request('http://localhost/', {
        headers: { 'User-Agent': 'curl/8.0' },
      }),
      mockEnv,
    )
    expect(res).not.toBeNull()
    expect(res?.status).toBe(200)
    expect(res?.headers.get('content-type')).toContain('text/markdown')
    const body = await res?.text()
    expect(body).toContain('Fetch any URL as markdown')
  })

  it('returns markdown for Accept: text/markdown', async () => {
    const res = await handler.fetch(
      new Request('http://localhost/', {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'text/markdown',
        },
      }),
      mockEnv,
    )
    expect(res).not.toBeNull()
    expect(res?.status).toBe(200)
    expect(res?.headers.get('content-type')).toContain('text/markdown')
    const body = await res?.text()
    expect(body).toContain('Fetch any URL as markdown')
  })

  it('returns null for browser user-agent', async () => {
    const res = await handler.fetch(
      new Request('http://localhost/', {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html',
        },
      }),
      mockEnv,
    )
    expect(res.status).toBe(200)
  })

  it('returns markdown when no user-agent is set', async () => {
    const res = await handler.fetch(
      new Request('http://localhost/', {
        headers: { 'User-Agent': '' },
      }),
      mockEnv,
    )
    expect(res).not.toBeNull()
    expect(res?.status).toBe(200)
    expect(res?.headers.get('content-type')).toContain('text/markdown')
  })
})
