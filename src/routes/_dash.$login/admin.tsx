import { createFileRoute, notFound } from '@tanstack/react-router'
import * as React from 'react'
import { Dashboard } from '#components/Dashboard.tsx'

export const Route = createFileRoute('/_dash/$login/admin')({
  beforeLoad({ context }) {
    if (context.account.role !== 'crew') throw notFound()
  },
  head: () => ({ meta: [{ title: `Admin - ${__HOST__}` }] }),
  component: Component,
})

function Component() {
  const [triggered, setTriggered] = React.useState(false)

  return (
    <Dashboard.Content>
      <Dashboard.Heading level={1}>Admin</Dashboard.Heading>
      <div className="bg-gray-a1/50 border-gray-a3 flex flex-col gap-3 border p-4">
        <div>
          <h2 className="text-sm font-bold">Sentry Test error reporting</h2>
          <p className="text-gray8 mt-1 text-sm">
            Trigger a client-side error to verify Sentry is receiving dashboard events.
          </p>
        </div>
        <button
          className="bg-red9 text-bg1 h-8 self-start px-3 text-sm transition-opacity hover:opacity-90"
          onClick={() => {
            setTriggered(true)
            console.info('Sentry test error triggered. Check the browser console and Sentry.')
            setTimeout(() => {
              throw new Error('Sentry Test Error')
            })
          }}
          type="button"
        >
          Break the world
        </button>
      </div>
      {triggered && (
        <p className="text-gray8 mt-3 text-sm">
          Test error triggered. Check the browser console and Sentry issue stream.
        </p>
      )}
    </Dashboard.Content>
  )
}
