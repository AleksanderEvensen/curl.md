import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { Dashboard } from '#components/Dashboard.tsx'
import { DashboardCliHelp } from '#components/DashboardCliHelp.tsx'

export const Route = createFileRoute('/_dash/$login/members')({
  head: () => ({ meta: [{ title: `Members - ${__HOST__}` }] }),
  beforeLoad({ context }) {
    if (context.entity.type !== 'organization') throw notFound()
  },
  component: Component,
})

function Component() {
  const { entity } = Route.useRouteContext()

  return (
    <Dashboard.Content>
      <Dashboard.Heading level={1}>Members</Dashboard.Heading>
      <DashboardCliHelp
        beforeCommand={`curl.md org switch ${entity.login}`}
        command="curl.md org member --help"
        title="Manage members from the CLI"
      >
        Member management lives in the CLI for now. Run the following to see available commands.
        Learn more in the{' '}
        <Link
          className="underline underline-offset-2"
          params={{ _splat: 'guide/cli' }}
          to="/docs/$"
        >
          documentation
        </Link>
        .
      </DashboardCliHelp>
    </Dashboard.Content>
  )
}
