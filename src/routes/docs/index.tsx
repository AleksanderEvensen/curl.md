import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'
import * as React from 'react'
import { rpc } from '#lib/rpc.ts'
import { findDoc } from './-catalog.ts'
import { getDocsHead, useDocsSignedIn, validateSearch } from './-helpers.ts'
import { DocsRouteContent } from './-route.tsx'

export const Route = createFileRoute('/docs/')({
  head() {
    const doc = findDoc('')
    const ogImage = rpc.api['og.png']
      .$url({
        query: {
          description: doc?.description,
          page: 'docs',
          title: doc?.title ?? 'Docs',
        },
      })
      .toString()
    return getDocsHead('', ogImage)
  },
  loader() {
    if (!findDoc('')) throw notFound()
  },
  validateSearch,
  component: Component,
})

const docsIndexRouteApi = getRouteApi('/docs/')

function Component() {
  const navigate = docsIndexRouteApi.useNavigate()
  const signedIn = useDocsSignedIn()
  const handleCodeGroupValueChange = React.useCallback(
    (value: string) => {
      navigate({
        replace: true,
        resetScroll: false,
        search: (search) => ({ ...search, tab: value }),
        to: '/docs',
      })
    },
    [navigate],
  )
  return (
    <DocsRouteContent
      docPath=""
      onCodeGroupValueChange={handleCodeGroupValueChange}
      signedIn={signedIn}
    />
  )
}
