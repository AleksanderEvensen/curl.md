export type ParsedAcceptValue = {
  order: number
  q: number
  specificity: number
  subtype: string
  type: string
}

export function negotiateAccept<key extends string>(
  acceptHeader: string | null | undefined,
  match: (acceptedValue: ParsedAcceptValue) => key | null,
) {
  const acceptedValues = parseAcceptHeader(acceptHeader)
  let bestMatch:
    | (Pick<ParsedAcceptValue, 'order' | 'q' | 'specificity'> & {
        key: key
      })
    | null = null

  for (const acceptedValue of acceptedValues) {
    const key = match(acceptedValue)
    if (!key) continue

    const candidate = {
      key,
      order: acceptedValue.order,
      q: acceptedValue.q,
      specificity: acceptedValue.specificity,
    }
    if (!bestMatch || compareAcceptMatches(candidate, bestMatch) > 0) bestMatch = candidate
  }

  return bestMatch?.key ?? null
}

export function appendVaryAccept(response: Response) {
  const headers = new Headers(response.headers)
  const vary = headers.get('vary')
  const entries = new Set(
    vary
      ?.split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean) ?? [],
  )
  if (!entries.has('accept')) headers.set('vary', vary ? `${vary}, Accept` : 'Accept')

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export function parseAcceptHeader(acceptHeader: string | null | undefined) {
  const header = acceptHeader?.trim() ? acceptHeader : '*/*'
  const values = header
    .split(',')
    .map((entry, order) => parseAcceptValue(entry, order))
    .filter((entry) => entry !== null)

  if (values.length > 0) return values
  return [{ order: 0, q: 1, specificity: 0, subtype: '*', type: '*' }]
}

function compareAcceptMatches(
  a: Pick<ParsedAcceptValue, 'order' | 'q' | 'specificity'>,
  b: Pick<ParsedAcceptValue, 'order' | 'q' | 'specificity'>,
) {
  if (a.q !== b.q) return a.q > b.q ? 1 : -1
  if (a.specificity !== b.specificity) return a.specificity > b.specificity ? 1 : -1
  if (a.order !== b.order) return a.order < b.order ? 1 : -1
  return 0
}

function parseAcceptValue(value: string, order: number) {
  const [rawMediaType, ...rawParameters] = value.split(';').map((entry) => entry.trim())
  const parsedMediaType = parseMediaType(rawMediaType)
  if (!parsedMediaType) return null

  let q = 1
  for (const parameter of rawParameters) {
    const [name, rawValue] = parameter.split('=', 2).map((entry) => entry.trim())
    if (name?.toLowerCase() !== 'q') continue
    const parsedQ = Number.parseFloat(rawValue ?? '')
    if (Number.isFinite(parsedQ)) q = Math.min(1, Math.max(0, parsedQ))
  }

  return {
    ...parsedMediaType,
    order,
    q,
    specificity: getAcceptSpecificity(parsedMediaType.type, parsedMediaType.subtype),
  }
}

function parseMediaType(mediaType: string | undefined) {
  if (!mediaType) return null
  const [type, subtype, ...rest] = mediaType
    .toLowerCase()
    .split('/')
    .map((entry) => entry.trim())
  if (!type || !subtype || rest.length > 0) return null
  return { subtype, type }
}

function getAcceptSpecificity(type: string, subtype: string) {
  if (type === '*' && subtype === '*') return 0
  if (subtype === '*') return 1
  return 2
}
