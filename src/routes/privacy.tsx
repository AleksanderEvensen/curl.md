import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  beforeLoad() {
    throw redirect({ params: { _splat: 'privacy' }, to: '/docs/$' })
  },
})
