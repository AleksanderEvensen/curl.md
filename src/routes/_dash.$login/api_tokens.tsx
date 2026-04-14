import { createFileRoute, Link } from '@tanstack/react-router'
import { Dashboard } from '#components/Dashboard.tsx'
import { DashboardCliHelp } from '#components/DashboardCliHelp.tsx'

export const Route = createFileRoute('/_dash/$login/api_tokens')({
  head: () => ({ meta: [{ title: `API Tokens - ${__HOST__}` }] }),
  component: Component,
})

function Component() {
  const { entity } = Route.useRouteContext()

  return (
    <Dashboard.Content>
      <Dashboard.Heading level={1}>API Tokens</Dashboard.Heading>
      <DashboardCliHelp
        beforeCommand={`curl.md org switch ${entity.login}`}
        command="curl.md token --help"
        title="Manage API tokens from the CLI"
      >
        API token management lives in the CLI for now. Run the following to see available commands.
        Learn more in the{' '}
        <Link className="underline underline-offset-2" to="/docs">
          documentation
        </Link>
        .
      </DashboardCliHelp>
    </Dashboard.Content>
  )
}
