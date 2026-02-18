import geistMonoLatin from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { themeScript, useTheme } from '#lib/theme.ts'
import '../styles.css'

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
        content: 'width=device-width, initial-scale=1',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { label, mounted, cycle } = useTheme()
  return (
    <>
      <div className="mx-auto max-w-xl px-4 py-16 font-mono text-sm">
        <Outlet />
      </div>
      <div className="fixed end-4 bottom-4 flex gap-2 text-xs text-gray9">
        {mounted && (
          <button
            className="cursor-pointer hover:text-gray10"
            onClick={cycle}
            type="button"
          >
            {label}
          </button>
        )}
        <a
          className="hover:text-gray10"
          href={
            __GIT_SHA__ === 'dev'
              ? 'https://github.com/wevm/curl.md'
              : `https://github.com/wevm/curl.md/commit/${__GIT_SHA__}`
          }
          rel="noopener noreferrer"
          target="_blank"
        >
          {__GIT_SHA__}
        </a>
      </div>
    </>
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
