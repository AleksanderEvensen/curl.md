import { createFileRoute, redirect, type MetaDescriptor } from '@tanstack/react-router'
import { rpc } from '#lib/rpc.ts'
import { getSessionLogin } from '#server/session.ts'
import { Home } from './-home.tsx'

export const Route = createFileRoute('/home')({
  async beforeLoad() {
    const login = await getSessionLogin()
    if (!login) throw redirect({ to: '/' })
    return { login }
  },
  head() {
    const ogImage = rpc.api['og.png'].$url({ query: { page: 'index' } }).toString()
    return {
      meta: [
        { title: 'curl.md - URL to markdown for agents' },
        { name: 'description', content: 'URL to markdown for agents' },
        { property: 'og:title', content: __HOST__ },
        { property: 'og:description', content: 'URL to markdown for agents' },
        { property: 'og:image', content: ogImage },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/png' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `https://${__HOST__}` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: __HOST__ },
        { name: 'twitter:description', content: 'URL to markdown for agents' },
        { name: 'twitter:image', content: ogImage },
      ] satisfies Array<MetaDescriptor>,
    }
  },
  loader: ({ context }) => ({ login: context.login }),
  component: () => <Home login={Route.useLoaderData().login} />,
})
