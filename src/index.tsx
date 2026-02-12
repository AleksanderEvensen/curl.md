import { Hono } from 'hono'
import { Credential } from 'mpay'
import { Mpay, Store, tempo } from 'mpay/server'
import { Stream } from 'mpay/tempo'
import { createClient, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  tempo as tempoMainnet,
  tempoModerato as tempoTestnet,
} from 'viem/chains'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const query = c.req.query('url')
  const targetURL = (() => {
    if (!query) return
    try {
      const url = new URL(query.includes('://') ? query : `https://${query}`)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url
    } catch {}
  })()

  if (!targetURL) {
    const ua = (c.req.header('user-agent') ?? '').toLowerCase()
    const accept = c.req.header('accept') ?? ''
    const isTerminal = /^(curl|httpie|wget)\b/i.test(ua) || !ua
    if (isTerminal || accept.includes('text/markdown'))
      return new Response(markdown({ host: c.env.HOST }), {
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      })
    return c.html(<HTML host={c.env.HOST} />)
  }

  const account = privateKeyToAccount(c.env.TEMPO_PRIVATE_KEY as Hex)
  const client = createClient({
    account,
    chain: c.env.TEMPO_CHAIN === 'mainnet' ? tempoMainnet : tempoTestnet,
    pollingInterval: 1_000,
    transport: http(c.env.TEMPO_RPC_URL),
  })
  const mpay = Mpay.create({
    methods: [
      tempo.session({
        account,
        currency: '0x20c0000000000000000000000000000000000000',
        feePayer: true,
        getClient: () => client,
        store: Store.cloudflare(c.env.KV),
        testnet: true,
      }),
    ],
  })

  const channelId = c.req.query('channel') as Hex | undefined
  const payment = await mpay.session({
    amount: '0.001',
    channelId,
    unitType: 'request',
  })(c.req.raw)
  if (payment.status === 402) return payment.challenge

  // Schedule session settlement after idle timeout
  const authHeader = c.req.header('authorization')
  if (authHeader)
    try {
      const credential = Credential.deserialize<{ channelId?: Hex }>(authHeader)
      const channelId = credential.payload.channelId
      if (channelId) {
        await c.env.KV.put(
          `session:${channelId}:lastActive`,
          Date.now().toString(),
        )
        await c.env.QUEUE.send(
          { channelId },
          { delaySeconds: sessionIdleTimeout },
        )
      }
    } catch {}

  const upstream = await fetch(targetURL.toString(), {
    headers: {
      Accept: 'text/markdown, text/html',
      'User-Agent': `${c.env.HOST}/1.0`,
    },
  })

  // Pass through if already markdown
  const upstreamContentType = upstream.headers
    .get('content-type')
    ?.toLowerCase()
  if (upstreamContentType?.includes('text/markdown')) {
    const body = await upstream.text()
    const headers = new Headers()
    const contentType = upstream.headers.get('content-type')
    const tokenCount = upstream.headers.get('x-markdown-tokens')
    const contentSignal = upstream.headers.get('content-signal')
    const vary = upstream.headers.get('vary')

    if (contentType) headers.set('content-type', contentType)
    if (tokenCount) headers.set('x-markdown-tokens', tokenCount)
    if (contentSignal) headers.set('content-signal', contentSignal)
    if (vary) headers.set('vary', vary)
    headers.set('cache-control', 'no-store')

    const response = new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })

    return payment.withReceipt(response)
  }

  // Try AI conversion
  const html = await upstream.text()
  try {
    const conversion = await c.env.AI.toMarkdown([
      {
        name: targetURL.hostname,
        blob: new Blob([html], { type: 'text/html' }),
      },
    ])
    const result = conversion[0]
    if (result?.format === 'markdown' && result.data)
      return payment.withReceipt(
        new Response(result.data, {
          status: 200,
          headers: new Headers({
            'content-type': 'text/markdown; charset=utf-8',
            'cache-control': 'no-store',
            'x-markdown-tokens': result.tokens?.toString() ?? '0',
          }),
        }),
      )
  } catch {}

  const browserResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${c.env.BROWSER_RENDERING_API_TOKEN}`,
      },
      body: JSON.stringify({ url: targetURL.toString() }),
    },
  )
  const data = (await browserResponse.json()) as {
    success?: boolean
    result?: string
    errors?: unknown
  }
  if (!browserResponse.ok || !data.success || !data.result)
    return payment.withReceipt(
      new Response(
        JSON.stringify({ error: 'Browser Rendering conversion failed' }),
        {
          status: 502,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        },
      ),
    )

  return payment.withReceipt(
    new Response(data.result, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'no-store',
      },
    }),
  )
})

export default {
  fetch: app.fetch,
  async queue(batch, env) {
    const account = privateKeyToAccount(env.TEMPO_PRIVATE_KEY as Hex)
    const client = createClient({
      account,
      chain: env.TEMPO_CHAIN === 'mainnet' ? tempoMainnet : tempoTestnet,
      pollingInterval: 1_000,
      transport: http(env.TEMPO_RPC_URL),
    })
    const store = Store.cloudflare(env.KV)
    const channelStore = Stream.ChannelStore.fromStore(store)
    const escrowContract = '0x9d136eEa063eDE5418A6BC7bEafF009bBb6CFa70'

    for (const msg of batch.messages) {
      const { channelId } = msg.body
      const lastActive = await env.KV.get(`session:${channelId}:lastActive`)

      if (lastActive) {
        const elapsed = Date.now() - Number(lastActive)
        if (elapsed < sessionIdleTimeout * 1_000) {
          msg.retry()
          continue
        }
      }

      try {
        await tempo.settle(channelStore, client, escrowContract, channelId)
        await env.KV.delete(`session:${channelId}:lastActive`)
        msg.ack()
      } catch {
        msg.retry()
      }
    }
  },
} satisfies ExportedHandler<Env, Parameters<Awaited<Env['QUEUE']['send']>>[0]>

const sessionIdleTimeout = 300 // 5 minutes

interface Env extends Cloudflare.Env {
  // Adding stronger queue types
  // https://github.com/cloudflare/workers-sdk/issues/7112
  QUEUE: Queue<{ channelId: Hex }>
}

type Props = { host: string }

function markdown(props: Props) {
  const { host } = props
  return `---
title: ${host}
---

# ${host}

Fetch any URL as markdown.

\`\`\`
curl ${host}?url=example.com
\`\`\`

Powered by [Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents) with Workers AI and Browser Rendering fallbacks.
`
}

function HTML(props: Props) {
  const { host } = props
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{host}</title>
        <style>{`
              body { font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; color: #e0e0e0; background: #111; }
              h1 { font-size: 1.5rem; }
              code { background: #222; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
              pre { background: #222; padding: 1rem; border-radius: 6px; overflow-x: auto; }
              pre code { background: none; padding: 0; }
              a { color: #6cb6ff; }
            `}</style>
      </head>
      <body>
        <h1>{host}</h1>
        <p>Fetch any URL as markdown.</p>
        <pre>
          <code>curl {host}?url=example.com</code>
        </pre>
        <p>
          Powered by{' '}
          <a href="https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents">
            Cloudflare Markdown for Agents
          </a>{' '}
          with Workers AI and Browser Rendering fallbacks.
        </p>
      </body>
    </html>
  )
}
