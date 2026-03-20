import { defineRule } from '../mod.ts'

export const mdn = defineRule({
  key: 'mdn',
  patterns: [
    new URLPattern({ hostname: 'developer.mozilla.org', pathname: '/:locale/docs/:path+' }),
  ],
  checks: [
    {
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
      title: 'Array.prototype.map()',
      contains: ['map('],
      notContains: ['{{'],
      minLength: 500,
    },
  ],
  rewrite(_url, match) {
    const locale = match.pathname.groups.locale?.toLowerCase()
    const repo = locale === 'en-us' ? 'mdn/content' : 'mdn/translated-content'
    return new URL(
      `https://raw.githubusercontent.com/${repo}/main/files/${locale}/${match.pathname.groups.path!.toLowerCase()}/index.md`,
    )
  },
  async extract(response) {
    let text = await response.text()

    // Extract title from frontmatter
    let title: string | undefined
    if (text.startsWith('---\n')) {
      const end = text.indexOf('\n---\n', 4)
      if (end !== -1) {
        const fm = text.slice(4, end)
        title = fm.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '')
        text = text.slice(end + 5).replace(/^\n+/, '')
      }
    }

    // Strip block-level macros (Specifications, Compat, sidebar, etc.)
    text = text.replace(
      /^\{\{(Specifications|Compat|cssinfo|csssyntax|InheritanceDiagram|APIRef|DefaultAPISidebar|InteractiveExample|EmbedLiveSample|PreviousNext|Previous|Next|NextMenu|PreviousMenu)\b[^}]*\}\}\s*$/gm,
      '',
    )

    // Convert cross-reference macros to linked inline code
    // {{jsxref("Array/map", "map()")}} → [`map()`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
    // {{jsxref("Array")}} → [`Array`](/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
    text = text.replace(
      /\{\{(?:jsxref|cssxref|domxref|HTMLElement|SVGElement|SVGAttr|MathMLElement|CSSXref)\(["']([^"']+)["'](?:,\s*["']([^"']+)["'])?[^)]*\)\}\}/gi,
      (_, ref: string, display: string | undefined) => {
        const label = display ?? ref.split('/').pop()!
        const path = xrefPath(ref, _)
        if (!path) return `\`${label}\``
        return `[\`${label}\`](${path})`
      },
    )

    // Convert HTTP macros to linked inline code
    text = text.replace(
      /\{\{(?:HTTPHeader|HTTPMethod|HTTPStatus|httpheader|httpmethod|httpstatus)\(["']([^"']+)["'](?:,\s*["']([^"']+)["'])?[^)]*\)\}\}/gi,
      (_, ref: string, display: string | undefined) => {
        const label = display ?? ref
        const type = _.match(/\{\{(\w+)/)?.[1]?.replace(/^http/i, 'HTTP')
        const section = type?.startsWith('HTTPHeader')
          ? 'Headers'
          : type?.startsWith('HTTPMethod')
            ? 'Methods'
            : type?.startsWith('HTTPStatus')
              ? 'Status'
              : undefined
        if (!section) return `\`${label}\``
        return `[\`${label}\`](/en-US/docs/Web/HTTP/${section}/${ref})`
      },
    )

    // Convert Glossary macros to plain text
    text = text.replace(
      /\{\{Glossary\(["']([^"']+)["'](?:,\s*["']([^"']+)["'])?[^)]*\)\}\}/gi,
      (_, _ref, display) => display ?? _ref.replace(/_/g, ' '),
    )

    // Convert inline status macros to text
    text = text.replace(/\{\{optional_inline\}\}/gi, '_(optional)_')
    text = text.replace(/\{\{ReadOnlyInline\}\}/gi, '_(read-only)_')
    text = text.replace(/\{\{Experimental_Inline\}\}/gi, '_(experimental)_')
    text = text.replace(/\{\{Deprecated_Inline\}\}/gi, '_(deprecated)_')
    text = text.replace(/\{\{Non-standard_Inline\}\}/gi, '_(non-standard)_')

    // Strip any remaining macros
    text = text.replace(/\{\{[^}]+\}\}/g, '')

    // Clean code block info strings (remove example-good, hidden, interactive-example, etc.)
    text = text.replace(
      /^(```\w[\w-]*)(?:\s+(?:example-good|example-bad|hidden|interactive-example(?:-choice)?|live-sample___\S+|-nolint))+\s*$/gm,
      '$1',
    )
    // Handle -nolint suffix on language (e.g. js-nolint → js)
    text = text.replace(/^```(\w+)-nolint\s*$/gm, '```$1')

    // Collapse excessive blank lines
    text = text.replace(/\n{3,}/g, '\n\n')

    return {
      content: text.trim(),
      meta: {
        ...(title && { title }),
      },
    }
  },
})

const xrefBases: Record<string, string> = {
  jsxref: '/en-US/docs/Web/JavaScript/Reference/Global_Objects/',
  cssxref: '/en-US/docs/Web/CSS/',
  domxref: '/en-US/docs/Web/API/',
  htmlelement: '/en-US/docs/Web/HTML/Element/',
  svgelement: '/en-US/docs/Web/SVG/Element/',
  svgattr: '/en-US/docs/Web/SVG/Attribute/',
  mathmlelement: '/en-US/docs/Web/MathML/Element/',
}

function xrefPath(ref: string, fullMatch: string): string | undefined {
  const macroName = fullMatch.match(/\{\{(\w+)/)?.[1]?.toLowerCase()
  if (!macroName) return undefined
  const base = xrefBases[macroName]
  if (!base) return undefined
  // Normalize: strip trailing "()", replace dots with slashes for jsxref
  let slug = ref.replace(/\(\)$/, '')
  if (macroName === 'jsxref') slug = slug.replace(/\./g, '/').replace(/\/prototype\//gi, '/')
  return `${base}${slug}`
}
