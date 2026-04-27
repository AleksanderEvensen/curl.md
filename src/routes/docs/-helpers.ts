import * as Query from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod/v4'
import { getSessionLogin } from '#server/session.ts'
import { findDoc } from './-catalog.ts'

export const validateSearch = z.object({
  q: z.string().optional(),
  tab: z.string().optional(),
})

export function getDocsHead(path: string, ogImage: string) {
  const doc = findDoc(path)
  const title = `${doc?.title ?? 'Docs'} - ${__HOST__}`
  const url = `https://${__HOST__}/docs${path ? `/${path}` : ''}`

  return {
    meta: [
      { title },
      { name: 'description', content: doc?.description ?? 'URL to markdown for agents' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: doc?.description ?? 'URL to markdown for agents' },
      { property: 'og:image', content: ogImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: url },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: doc?.description ?? 'URL to markdown for agents' },
      { name: 'twitter:image', content: ogImage },
    ],
  }
}

export const docsRouteApi = getRouteApi('/docs')

export function useDocsSession() {
  const { hasSessionCookie } = docsRouteApi.useLoaderData()
  const fetchLogin = useServerFn(getSessionLogin)
  const { data } = Query.useQuery({
    enabled: typeof window !== 'undefined' && hasSessionCookie,
    queryFn: () => fetchLogin(),
    queryKey: ['session-login'],
  })

  if (!hasSessionCookie) return { login: null, signedIn: false }
  return { login: data, signedIn: data !== null }
}

export function useDocsSignedIn() {
  return useDocsSession().signedIn
}
