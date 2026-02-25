export type ScoreCategory = {
  label: string
  score: number
  tips: string[]
}

export type ScoreResult = {
  categories: ScoreCategory[]
  overall: number
}

export function computeScore(data: {
  markdown: string
  rawHtmlLength: number
  tokensCount: number
  tokensSaved: number
}): ScoreResult {
  const { markdown, rawHtmlLength, tokensCount, tokensSaved } = data
  const categories: ScoreCategory[] = [
    scoreStructure(markdown),
    scoreNoise(markdown),
    scoreMetadata(markdown),
    scoreCompression(rawHtmlLength, tokensCount, tokensSaved),
    scoreReadability(markdown),
  ]
  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  )
  return { categories, overall }
}

function scoreStructure(markdown: string): ScoreCategory {
  const tips: string[] = []
  let score = 100

  const headings = markdown.match(/^#{1,6} .+/gm) ?? []
  if (headings.length === 0) {
    score -= 30
    tips.push('Add headings to provide document structure')
  }

  const h1s = headings.filter((h) => h.startsWith('# ') && !h.startsWith('## '))
  if (h1s.length === 0) {
    score -= 15
    tips.push('Include a top-level heading (h1)')
  } else if (h1s.length > 1) {
    score -= 10
    tips.push('Use only one h1 heading per page')
  }

  // Check for heading level skips (e.g. h1 -> h3)
  const levels = headings.map((h) => h.match(/^(#+)/)?.[1].length ?? 0)
  for (let i = 1; i < levels.length; i++) {
    const current = levels[i] ?? 0
    const previous = levels[i - 1] ?? 0
    if (current - previous > 1) {
      score -= 10
      tips.push('Avoid skipping heading levels (e.g. h1 to h3)')
      break
    }
  }

  const lists = markdown.match(/^[\s]*[-*+] .+|^\s*\d+\. .+/gm) ?? []
  if (lists.length === 0 && markdown.length > 500) {
    score -= 5
    tips.push('Consider using lists for structured content')
  }

  return { label: 'Structure', score: Math.max(0, score), tips }
}

function scoreNoise(markdown: string): ScoreCategory {
  const tips: string[] = []
  let score = 100

  // Check for excessive consecutive blank lines
  const tripleNewlines = (markdown.match(/\n{4,}/g) ?? []).length
  if (tripleNewlines > 3) {
    score -= 15
    tips.push('Reduce excessive blank lines in output')
  }

  // Check for leftover HTML tags
  const htmlTags = (markdown.match(/<[a-z][^>]*>/gi) ?? []).length
  if (htmlTags > 5) {
    score -= 20
    tips.push('Clean up leftover HTML tags in the markdown')
  } else if (htmlTags > 0) {
    score -= 5
  }

  // Check for very long lines (likely un-wrapped content)
  const lines = markdown.split('\n')
  const longLines = lines.filter((l) => l.length > 500).length
  if (longLines > 3) {
    score -= 10
    tips.push('Break up very long lines for better readability')
  }

  // Check for navigation/boilerplate patterns
  const navPatterns =
    /\b(skip to|cookie|privacy policy|terms of service|sign in|log in|subscribe)\b/gi
  const navMatches = (markdown.match(navPatterns) ?? []).length
  if (navMatches > 5) {
    score -= 15
    tips.push('Reduce navigation and boilerplate text in output')
  }

  return { label: 'Noise', score: Math.max(0, score), tips }
}

function scoreMetadata(markdown: string): ScoreCategory {
  const tips: string[] = []
  let score = 100

  // Check for title (first h1)
  const hasTitle = /^# .+/m.test(markdown)
  if (!hasTitle) {
    score -= 25
    tips.push('Include a clear page title as an h1 heading')
  }

  // Check for links
  const links = (markdown.match(/\[.+?\]\(.+?\)/g) ?? []).length
  if (links === 0 && markdown.length > 200) {
    score -= 15
    tips.push('Include relevant links for context')
  }

  // Check for code blocks
  const codeBlocks = (markdown.match(/```/g) ?? []).length / 2
  const hasInlineCode = /`[^`]+`/.test(markdown)
  if (codeBlocks === 0 && !hasInlineCode && markdown.length > 1000) {
    // Not penalized, but noted — many pages don't need code
  }

  // Check for images/alt text
  const images = markdown.match(/!\[([^\]]*)\]\([^)]+\)/g) ?? []
  const imagesWithoutAlt = images.filter((img) => /!\[\]\(/.test(img)).length
  if (imagesWithoutAlt > 0) {
    score -= 10
    tips.push('Add alt text to images for better context')
  }

  return { label: 'Metadata', score: Math.max(0, score), tips }
}

function scoreCompression(
  rawHtmlLength: number,
  tokensCount: number,
  tokensSaved: number,
): ScoreCategory {
  const tips: string[] = []
  let score = 100

  if (rawHtmlLength === 0)
    return {
      label: 'Compression',
      score: 50,
      tips: ['Could not measure raw HTML size'],
    }

  const totalTokens = tokensCount + tokensSaved
  const ratio = totalTokens > 0 ? tokensSaved / totalTokens : 0

  if (ratio < 0.1) {
    score -= 30
    tips.push(
      'HTML is not being significantly compressed — consider simplifying page markup',
    )
  } else if (ratio < 0.3) {
    score -= 15
    tips.push('Moderate compression — reduce unnecessary HTML elements')
  }

  const markdownLength = tokensCount * 4 // approximate
  const htmlToMdRatio = rawHtmlLength > 0 ? markdownLength / rawHtmlLength : 1
  if (htmlToMdRatio > 0.8) {
    score -= 10
    tips.push('Markdown output is nearly as large as raw HTML')
  }

  return { label: 'Compression', score: Math.max(0, score), tips }
}

function scoreReadability(markdown: string): ScoreCategory {
  const tips: string[] = []
  let score = 100

  // Check for reasonable paragraph length
  const paragraphs = markdown
    .split(/\n\n+/)
    .filter((p) => p.trim() && !p.startsWith('#') && !p.startsWith('```'))
  const longParagraphs = paragraphs.filter((p) => p.length > 1000).length
  if (longParagraphs > 2) {
    score -= 15
    tips.push('Break up long paragraphs for better readability')
  }

  // Check for content density
  if (markdown.trim().length < 50) {
    score -= 30
    tips.push('Page produced very little markdown content')
  } else if (markdown.trim().length < 200) {
    score -= 15
    tips.push('Page produced minimal content')
  }

  // Check for emphasis usage
  const emphasis = (markdown.match(/\*\*[^*]+\*\*|__[^_]+__/g) ?? []).length
  if (emphasis === 0 && markdown.length > 1000) {
    score -= 5
    tips.push('Consider using bold text to highlight key information')
  }

  return { label: 'Readability', score: Math.max(0, score), tips }
}
