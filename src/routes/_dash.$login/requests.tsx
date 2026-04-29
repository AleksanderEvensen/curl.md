import { createFileRoute, Link } from '@tanstack/react-router'
import { Dashboard } from '#components/Dashboard.tsx'
import { DashboardCliHelp } from '#components/DashboardCliHelp.tsx'

function Component() {
  const { entity } = Route.useRouteContext()

  return (
    <Dashboard.Content>
      <Dashboard.Heading level={1}>Requests</Dashboard.Heading>
      <DashboardCliHelp
        beforeCommand={`curl.md org switch ${entity.login}`}
        command="curl.md request --help"
        title="Manage requests from the CLI"
      >
        Request tooling lives in the CLI for now. Run the following to see available commands. Learn
        more in the{' '}
        <Link
          className="underline underline-offset-2"
          params={{ _splat: 'guide/cli' }}
          hash="request"
          to="/docs/$"
        >
          documentation
        </Link>
        .
      </DashboardCliHelp>
    </Dashboard.Content>
  )
}

export const Route = createFileRoute('/_dash/$login/requests')({
  head: () => ({ meta: [{ title: `Requests - ${__HOST__}` }] }),
  component: Component,
})
