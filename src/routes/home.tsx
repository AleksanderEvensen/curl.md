import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionLogin } from '#server/session.ts'
import { Home, head } from './-home.tsx'

export const Route = createFileRoute('/home')({
  async beforeLoad() {
    const login = await getSessionLogin()
    if (!login) throw redirect({ to: '/' })
    return { login }
  },
  head,
  loader: ({ context }) => ({ login: context.login }),
  component: () => <Home login={Route.useLoaderData().login} />,
})
