import geistMonoLatin from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { themeScript } from '#lib/theme.ts'
import '../styles.css'

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        as: 'font',
        crossOrigin: 'anonymous',
        href: geistMonoLatin,
        rel: 'preload',
        type: 'font/woff2',
      },
      { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
    ],
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="font-mono text-sm">
        <Outlet />
      </div>
    </QueryClientProvider>
  )
}

function RootDocument(props: React.PropsWithChildren) {
  const { children } = props
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: theme script is static
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
