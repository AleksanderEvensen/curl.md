import { Credential } from 'mppx'
import { Mppx, Store, tempo } from 'mppx/server'
import { Stream } from 'mppx/tempo'
import { createClient, type Hex, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  tempo as tempoMainnet,
  tempoModerato as tempoTestnet,
} from 'viem/chains'
import * as z from 'zod/v4'
import { extractMetadata } from './convert'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const rawQuery = Object.fromEntries(url.searchParams)
    const queryResult = z.safeParse(
      z.object({
        channel: z.string().optional(),
        fresh: z.string().optional(),
        full: z.string().optional(),
        objective: z.string().optional(),
        url: z
          .string()
          .transform((arg) => (arg.includes('://') ? arg : `https://${arg}`))
          .pipe(
            z.url({
              protocol: /^https?$/,
              hostname: z.regexes.domain,
              normalize: true,
            }),
          )
          .optional(),
      }),
      rawQuery,
    )
    if (!queryResult.success)
      return new Response(JSON.stringify(queryResult.error), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })

    const query = queryResult.data

    const targetURL = query.url ? new URL(query.url) : undefined

    if (!targetURL) {
      const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
      const isTerminal = /^(curl|httpie|wget)\b/i.test(ua) || !ua
      const accept = request.headers.get('accept') ?? ''
      if (isTerminal || accept.includes('text/markdown'))
        return new Response(markdown({ host: env.HOST }), {
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
      return env.ASSETS.fetch(request)
    }

    const account = privateKeyToAccount(env.TEMPO_PRIVATE_KEY as Hex)
    const client = createClient({
      account,
      chain: env.TEMPO_CHAIN === 'mainnet' ? tempoMainnet : tempoTestnet,
      transport: http(env.TEMPO_RPC_URL),
    })
    const mppx = Mppx.create({
      methods: [
        tempo.session({
          account,
          currency: '0x20c0000000000000000000000000000000000000',
          feePayer: true,
          getClient: () => client,
          store: Store.cloudflare(env.KV),
          testnet: true,
        }),
      ],
    })

    const payment = await mppx.session({
      amount: '0.001',
      channelId: query.channel,
      unitType: 'request',
    })(request)
    if (payment.status === 402) return payment.challenge

    // Schedule session settlement after idle timeout
    const authorization = request.headers.get('authorization')
    if (authorization)
      try {
        const credential = Credential.deserialize<{ channelId?: Hex }>(
          authorization,
        )
        const channelId = credential.payload.channelId
        if (channelId) {
          await env.KV.put(
            `session:${channelId}:lastActive`,
            Date.now().toString(),
          )
          await env.QUEUE.send(
            { channelId },
            { delaySeconds: sessionIdleTimeout },
          )
        }
      } catch {}

    const cacheKey = `cache:${targetURL.toString()}`

    // Check KV cache
    if (!query.fresh) {
      const cached = await env.KV.get(cacheKey)
      if (cached) {
        const result = z.parse(
          z.object({
            markdown: z.string(),
            publish_date: z.string().nullable(),
            title: z.string().nullable(),
          }),
          JSON.parse(cached),
        )
        return payment.withReceipt(
          await formatResponse({
            ai: env.AI,
            full: query.full,
            md: result.markdown,
            objective: query.objective,
            publish_date: result.publish_date,
            title: result.title,
            url: targetURL.toString(),
          }),
        )
      }
    }

    const upstream = await globalThis.fetch(targetURL.toString(), {
      headers: {
        Accept: 'text/markdown, text/html',
        'User-Agent': `${env.HOST}/1.0`,
      },
    })

    let md = ''
    let title: string | null = null
    let publish_date: string | null = null

    const upstreamContentType = upstream.headers
      .get('content-type')
      ?.toLowerCase()

    if (upstreamContentType?.includes('text/markdown'))
      md = await upstream.text()
    else {
      const html = await upstream.text()
      const metadata = extractMetadata(html)
      title = metadata.title
      publish_date = metadata.publishDate

      // Try AI conversion
      try {
        const conversion = await env.AI.toMarkdown([
          {
            name: targetURL.hostname,
            blob: new Blob([html], { type: 'text/html' }),
          },
        ])
        const result = conversion[0]
        if (result?.format === 'markdown' && result.data) md = result.data
      } catch {}

      // Fall back to Browser Rendering if AI conversion failed or result is thin
      if (!md || md.trim().length < 100) {
        const browserResponse = await globalThis.fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${env.BROWSER_RENDERING_API_TOKEN}`,
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
              JSON.stringify({
                error: 'conversion_failed',
                message: 'Both AI and Browser Rendering conversion failed',
              }),
              {
                status: 502,
                headers: {
                  'content-type': 'application/json; charset=utf-8',
                  'cache-control': 'no-store',
                },
              },
            ),
          )
        md = data.result
      }
    }

    // Cache result in KV (1 hour TTL)
    await env.KV.put(
      cacheKey,
      JSON.stringify({ markdown: md, title, publish_date }),
      { expirationTtl: 3600 },
    )

    return payment.withReceipt(
      await formatResponse({
        ai: env.AI,
        full: query.full,
        md,
        objective: query.objective,
        publish_date,
        title,
        url: targetURL.toString(),
      }),
    )
  },
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

function markdown(props: { host: string }) {
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

async function formatResponse(opts: {
  md: string
  title: string | null
  publish_date: string | null
  objective: string | undefined
  full: string | undefined
  url: string
  ai: Ai
}): Promise<Response> {
  const { md, title, publish_date, objective, full, url, ai } = opts
  const tokens = Math.ceil(md.length / 4)

  if (!objective)
    return new Response(md, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'no-store',
        'x-tokens': tokens.toString(),
        ...(title && { 'x-title': title }),
        ...(publish_date && { 'x-publish-date': publish_date }),
      },
    })

  const response = z.parse(
    z.object({ response: z.string().default('') }),
    await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages: [
        {
          role: 'system',
          content:
            "Extract only the parts of the following markdown that are relevant to the user's objective. Return the relevant content as markdown. Be concise — include only what directly addresses the objective.",
        },
        {
          role: 'user',
          content: `Objective: ${objective}\n\n---\n\n${md}`,
        },
      ],
    }),
  )

  const excerpt = response.response

  return new Response(
    JSON.stringify({
      excerpt,
      markdown: full ? md : null,
      publish_date,
      title,
      tokens: {
        excerpt: Math.ceil(excerpt.length / 4),
        markdown: full ? tokens : null,
      },
      url,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
}
