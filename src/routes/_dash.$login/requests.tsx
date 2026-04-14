import { Tooltip } from '@base-ui/react/tooltip'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import * as React from 'react'
import { Dashboard } from '#components/Dashboard.tsx'
import { createClient } from '#db/client.ts'
import { requestTokensSavedSql } from '#db/utils.ts'
import * as Cookie from '#lib/cookie.ts'

const searchDebounceMs = 250 // 250 milliseconds
const requestsRefreshIntervalMs = 10_000 // 10 seconds
const requestTimeFormatters = new Map<string, Intl.DateTimeFormat>()

function Component() {
  const { entity } = Route.useRouteContext()
  const initialData = Route.useLoaderData()
  const fetchRequests = useServerFn(getRequests)
  const [page, setPage] = React.useState(0)
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const queryClient = useQueryClient()
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput), searchDebounceMs)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const { data } = useQuery({
    initialData: page === 0 && search === '' ? initialData : undefined,
    queryKey: ['dashboard-requests', entity.id, page, search],
    queryFn: () =>
      fetchRequests({
        data: {
          entityId: entity.id,
          entityType: entity.type,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          search,
        },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: requestsRefreshIntervalMs,
    refetchOnMount: 'always',
  })

  React.useEffect(() => {
    if (!data) return

    const totalPages = Math.ceil(data.total / PAGE_SIZE)
    if (page >= totalPages - 1) return

    void queryClient.prefetchQuery({
      queryKey: ['dashboard-requests', entity.id, page + 1, search],
      queryFn: () =>
        fetchRequests({
          data: {
            entityId: entity.id,
            entityType: entity.type,
            limit: PAGE_SIZE,
            offset: (page + 1) * PAGE_SIZE,
            search,
          },
        }),
    })
  }, [data, entity.id, entity.type, fetchRequests, page, queryClient, search])

  if (!data) return null

  const totalPages = Math.ceil(data.total / PAGE_SIZE)

  return (
    <Dashboard.Content>
      <Dashboard.Heading level={1}>Requests</Dashboard.Heading>

      {(data.total > 0 || searchInput !== '' || search !== '') && (
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="flex flex-col gap-1">
            <span className="sr-only">Search requests by URL</span>
            <div className="relative w-full md:w-80">
              <IconLucideSearch className="text-gray8 pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
              <input
                className="bg-gray-a1/50 border-gray-a3 focus-visible:ring-blue8 w-full border py-2 ps-9 pe-10 text-sm outline-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                onChange={(e) => {
                  setPage(0)
                  setSearchInput(e.target.value)
                }}
                placeholder="Search requests by URL"
                ref={searchInputRef}
                type="search"
                value={searchInput}
              />
              {searchInput !== '' && (
                <button
                  aria-label="Clear search"
                  className="text-gray8 hover:text-gray10 focus-visible:ring-blue8 absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center outline-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                  onClick={() => {
                    setPage(0)
                    setSearch('')
                    setSearchInput('')
                    searchInputRef.current?.focus()
                  }}
                  type="button"
                >
                  <IconOcticonX16 className="size-4" />
                </button>
              )}
            </div>
          </label>
          {data.total > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2 self-end md:self-auto">
              {page > 0 && (
                <button
                  aria-label="Previous requests page"
                  className="text-gray9 hover:bg-gray-a2 hover:text-gray12 p-1"
                  onClick={() => setPage(page - 1)}
                  type="button"
                >
                  <IconOcticonChevronLeft16 className="size-4" />
                </button>
              )}
              <span className="text-gray8 text-sm tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                aria-label="Next requests page"
                className="text-gray9 hover:bg-gray-a2 hover:text-gray12 p-1 disabled:opacity-30"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                <IconOcticonChevronRight16 className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {data.total === 0 ? (
        <div className="border-gray-a3 bg-gray-a1/50 flex h-48 flex-col items-center justify-center border px-3 py-3">
          <span className="text-sm font-bold">
            {search ? 'No Matching Requests' : 'No Requests'}
          </span>
          <span className="text-gray8 mt-1 text-sm">
            {search
              ? 'Try a different URL filter.'
              : 'Requests will appear here once you start using curl.md.'}
          </span>
        </div>
      ) : (
        <>
          <div className="border-gray-a3 bg-gray-a1/50 border md:hidden">
            {data.requests.map((request) => (
              <div
                className="border-gray-a3 flex flex-col gap-2 border-b px-3 py-3 last:border-b-0"
                key={request.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs whitespace-nowrap">
                    <RequestTime timezone={data.timezone} value={request.created_at} />
                  </span>
                  <span className="text-gray8 shrink-0 text-xs tabular-nums">
                    {Math.round(request.tokens_saved).toLocaleString()} saved
                  </span>
                </div>

                <a
                  className="hover:text-gray12 block truncate text-sm underline-offset-2 hover:underline"
                  href={request.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {formatRequestUrl(request.url)}
                </a>

                <RequestIndicators request={request} />
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Dashboard.Table className="min-w-[52rem] table-fixed text-sm md:min-w-0">
              <colgroup>
                <col className="w-[21ch]" />
                <col />
                <col className="w-[4.5rem]" />
                <col className="w-[7rem]" />
              </colgroup>
              <Dashboard.Table.Thead>
                <Dashboard.Table.Th className="w-px pe-6 whitespace-nowrap">
                  Time
                </Dashboard.Table.Th>
                <Dashboard.Table.Th>URL</Dashboard.Table.Th>
                <Dashboard.Table.Th className="w-px">
                  <span className="sr-only">Flags</span>
                </Dashboard.Table.Th>
                <Dashboard.Table.Th align="end">Saved</Dashboard.Table.Th>
              </Dashboard.Table.Thead>
              <tbody>
                {data.requests.map((request) => (
                  <Dashboard.Table.Tr key={request.id}>
                    <Dashboard.Table.Td className="pe-6 align-top whitespace-nowrap">
                      <RequestTime timezone={data.timezone} value={request.created_at} />
                    </Dashboard.Table.Td>
                    <Dashboard.Table.Td className="min-w-0 align-top">
                      <a
                        className="hover:text-gray12 block truncate underline-offset-2 hover:underline"
                        href={request.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {formatRequestUrl(request.url)}
                      </a>
                    </Dashboard.Table.Td>
                    <Dashboard.Table.Td className="align-middle whitespace-nowrap">
                      <RequestIndicators request={request} />
                    </Dashboard.Table.Td>
                    <Dashboard.Table.Td className="text-end align-top whitespace-nowrap tabular-nums">
                      {Math.round(request.tokens_saved).toLocaleString()}
                    </Dashboard.Table.Td>
                  </Dashboard.Table.Tr>
                ))}
              </tbody>
            </Dashboard.Table>
          </div>
        </>
      )}
    </Dashboard.Content>
  )
}

const PAGE_SIZE = 20

export const Route = createFileRoute('/_dash/$login/requests')({
  head: () => ({ meta: [{ title: `Requests - ${__HOST__}` }] }),
  loader: ({ context }) =>
    getRequests({
      data: {
        entityId: context.entity.id,
        entityType: context.entity.type,
        limit: PAGE_SIZE,
        offset: 0,
        search: '',
      },
    }),
  component: Component,
})

const getRequests = createServerFn({ method: 'GET' })
  .inputValidator(
    (d: {
      entityId: string
      entityType: 'account' | 'organization'
      limit: number
      offset: number
      search: string
    }) => d,
  )
  .handler(async (c) => {
    const request = getRequest()
    const db = createClient(env.DB.connectionString)
    const timeZone = (request as { cf?: { timezone?: string } }).cf?.timezone ?? 'UTC'
    const sessionId = await Cookie.parseSigned(
      request.headers.get('cookie') ?? '',
      env.COOKIE_SECRET,
      'curl.session',
    )
    if (!sessionId) return { requests: [] as RequestRow[], timezone: timeZone, total: 0 }

    const ownerColumn = c.data.entityType === 'organization' ? 'organization_id' : 'account_id'
    const search = c.data.search.trim()

    const baseQuery = db.selectFrom('request').where(ownerColumn, '=', c.data.entityId)
    const filteredQuery = search ? baseQuery.where('url', 'ilike', `%${search}%`) : baseQuery

    const [countResult, requests] = await Promise.all([
      filteredQuery.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
      filteredQuery
        .select([
          'cached',
          'created_at',
          'id',
          'keywords',
          'objective',
          'url',
          requestTokensSavedSql().as('tokens_saved'),
        ])
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .offset(c.data.offset)
        .limit(c.data.limit)
        .execute(),
    ])

    return {
      requests: requests.map((request) => ({
        ...request,
        tokens_saved: Number(request.tokens_saved),
      })),
      timezone: timeZone,
      total: Number(countResult.total),
    }
  })

type RequestRow = {
  cached: boolean
  created_at: Date
  id: string
  keywords: string | null
  objective: string | null
  tokens_saved: number
  url: string
}

function formatKeywords(keywords: string) {
  return keywords.split(',').join(', ')
}

function RequestIndicators(props: { request: RequestRow }) {
  const { request } = props

  return (
    <Tooltip.Provider delay={0}>
      <div className="text-gray8 flex min-h-4 items-center gap-1.5">
        {request.objective ? (
          <RequestIndicator label={`Objective: ${request.objective}`}>
            <IconLucideTarget className="size-3.5" />
          </RequestIndicator>
        ) : null}
        {request.keywords ? (
          <RequestIndicator label={`Keywords: ${formatKeywords(request.keywords)}`}>
            <IconLucideTag className="size-3.5" />
          </RequestIndicator>
        ) : null}
        {request.cached ? (
          <RequestIndicator label="Cached response">
            <IconOcticonDatabase16 className="size-3.5" />
          </RequestIndicator>
        ) : null}
      </div>
    </Tooltip.Provider>
  )
}

function RequestIndicator(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label={props.label}
        className="text-gray8 hover:text-gray10 focus-visible:ring-blue8 inline-flex cursor-default p-0.5 outline-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        render={<button type="button" />}
      >
        <span className="inline-flex">{props.children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4}>
          <Tooltip.Popup className="bg-bg1 border-gray-a3 before:bg-gray-a1/50 relative z-50 max-w-64 border px-2.5 py-1.5 text-xs leading-relaxed before:absolute before:inset-0 before:-z-1">
            {props.label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function RequestTime(props: { timezone?: string | undefined; value: Date | string }) {
  const timeZone = props.timezone ?? 'UTC'
  const date = new Date(props.value)
  const formatter = getRequestTimeFormatter(timeZone)
  const parts = formatter.formatToParts(date)
  const currentYear = formatter
    .formatToParts(new Date())
    .find((part) => part.type === 'year')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  const centiseconds = parts.find((part) => part.type === 'fractionalSecond')?.value
  const hours = parts.find((part) => part.type === 'hour')?.value
  const minutes = parts.find((part) => part.type === 'minute')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const seconds = parts.find((part) => part.type === 'second')?.value
  const year = parts.find((part) => part.type === 'year')?.value

  if (!currentYear || !day || !centiseconds || !hours || !minutes || !month || !seconds || !year)
    throw new Error(`Could not format request time for ${timeZone}`)

  const datePrefix =
    year === currentYear ? `${month.toUpperCase()} ${day}` : `${month.toUpperCase()} ${day} ${year}`
  const time = `${hours}:${minutes}:${seconds}`

  return (
    <time dateTime={date.toISOString()}>
      <span className="text-gray7">{datePrefix}</span> <span className="text-gray12">{time}</span>
      <span className="text-gray7">.{centiseconds}</span>
    </time>
  )
}

function getRequestTimeFormatter(timeZone: string) {
  const existing = requestTimeFormatters.get(timeZone)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    fractionalSecondDigits: 2,
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: 'short',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  })
  requestTimeFormatters.set(timeZone, formatter)
  return formatter
}

function formatRequestUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}${url.search}`
  } catch {
    return value.replace(/^https?:\/\//, '')
  }
}
