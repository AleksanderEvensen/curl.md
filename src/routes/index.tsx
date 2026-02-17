import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { isTerminalClient } from '#lib/userAgents.ts'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: __HOST__ }],
  }),
  server: {
    middleware: [
      createMiddleware().server((options) => {
        const accept = options.request.headers.get('accept') ?? ''
        const userAgent = options.request.headers.get('user-agent') ?? ''
        if (!accept.includes('text/markdown') && !isTerminalClient(userAgent))
          return options.next()

        return new Response(
          `# curl.md

Fetch any URL as markdown.

\`\`\`bash
$ curl ${env.HOST}/example.com
\`\`\`
`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
          },
        )
      }),
    ],
  },
  component: Home,
})

function Home() {
  return (
    <>
      <h1 className="text-base font-bold">curl.md</h1>
      <p className="mt-6 text-gray9">Fetch any URL as markdown.</p>
      <pre className="mt-6 overflow-x-auto border border-gray-a3 p-4">
        <code>
          <span className="select-none">$ </span>
          {`curl ${__HOST__}/example.com`}
        </code>
      </pre>

      {/* TODO: add ASCII sequence diagram showing how it works */}
    </>
  )
}
