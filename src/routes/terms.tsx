import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  beforeLoad() {
    throw redirect({ params: { _splat: 'terms' }, to: '/docs/$' })
  },
})
