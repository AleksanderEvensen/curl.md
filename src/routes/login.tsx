import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Nav } from '#components/Nav.tsx'
import { getSessionLogin } from '#server/session.ts'

export const Route = createFileRoute('/login')({
  head() {
    return { meta: [{ title: `Sign In - ${__HOST__}` }] }
  },
  validateSearch: z.object({ next: z.string().optional() }),
  async beforeLoad() {
    const login = await getSessionLogin()
    if (login) throw redirect({ to: '/~dash/$login', params: { login } })
  },
  component: Login,
})

function Login() {
  const { next } = Route.useSearch()
  const href = (() => {
    const isPreview = __HOST__ !== 'curl.md' && __HOST__ !== 'curl.local'
    if (isPreview)
      return `https://curl.md/api/auth/github?next=${encodeURIComponent(next ? `${__ORIGIN__}${next}` : __ORIGIN__)}`
    if (next) return `/api/auth/github?next=${encodeURIComponent(next)}`
    return '/api/auth/github'
  })()
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Nav />

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-32">
        <div className="flex w-full max-w-xs flex-col">
          <h1 className="text-lg font-bold">Sign in</h1>
          <p className="text-gray8 mt-2 text-sm leading-relaxed">
            New to curl.md or been here before? Continue below to start curling.
          </p>
          <a
            className="bg-gray10 text-bg1 mt-6 flex h-11 w-full items-center justify-center gap-2 px-4 transition-opacity hover:opacity-90"
            href={href}
          >
            <IconOcticonMarkGithub16 className="size-5" />
            Continue with GitHub
          </a>
        </div>
      </main>
    </div>
  )
}
