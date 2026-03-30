import { defineRule } from '../mod.ts'

export const zero = defineRule({
  key: 'zero',
  patterns: [new URLPattern({ hostname: 'zero.rocicorp.dev', pathname: '/docs/*' })],
  checks: [{ url: 'https://zero.rocicorp.dev/docs/quickstart', contains: ['Zero'] }],
  rewrite(url) {
    return new URL(
      `https://raw.githubusercontent.com/rocicorp/zero-docs/main/contents${url.pathname}.mdx`,
    )
  },
  async extract(response) {
    let content = await response.text()
    content = stripMdxCodeGroup(content)
    content = content.replace(/^import\s.*$/gm, '')
    content = content.replace(/<Video\s+([\s\S]*?)\/>/g, (_match, attrs: string) => {
      const src = attrs.match(/src=["']([^"']+)["']/)?.[1]
      const alt = attrs.match(/alt=["']([^"']+)["']/)?.[1] ?? 'Video'
      if (!src) return ''
      const url = src.startsWith('/') ? `https://zero.rocicorp.dev${src}` : src
      return `[${alt}](${url})`
    })
    content = content.replace(/<[A-Z][^>]*\/>/g, '')
    content = content.replace(/<[A-Z][A-Za-z]*[^>]*>|<\/[A-Z][A-Za-z]*>/g, '')
    return { content }
  },
})

function stripMdxCodeGroup(content: string): string {
  return content.replace(
    /<CodeGroup\s*labels=\{(\[[\s\S]*?\])\}\s*>([\s\S]*?)<\/CodeGroup>/g,
    (_match, labelsRaw: string, body: string) => {
      const labels: Array<string> = []
      for (const m of labelsRaw.matchAll(/text:\s*['"]([^'"]+)['"]/g)) labels.push(m[1]!)
      const blocks = body.match(/```[\s\S]*?```/g) ?? []
      return blocks
        .map((block, i) => {
          const label = labels[i]
          if (!label) return block
          return block.replace(/^(```\w*)/, `$1 title="${label}"`)
        })
        .join('\n\n')
    },
  )
}
