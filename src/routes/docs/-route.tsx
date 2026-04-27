import * as React from 'react'
import { findDoc, findDocPagination } from './-catalog.ts'
import { DocContent } from './-render.tsx'

export function DocsRouteContent(props: {
  docPath: string
  onCodeGroupValueChange: (value: string, docPath: string) => void
  signedIn?: boolean
}) {
  const { docPath, onCodeGroupValueChange, signedIn = false } = props
  const doc = findDoc(docPath)
  if (!doc) return null

  const handleCodeGroupValueChange = React.useCallback(
    (value: string) => {
      onCodeGroupValueChange(value, doc.path)
    },
    [doc.path, onCodeGroupValueChange],
  )

  return (
    <DocContent
      doc={doc}
      onCodeGroupValueChange={handleCodeGroupValueChange}
      pagination={findDocPagination(doc.path)}
      signedIn={signedIn}
    />
  )
}
