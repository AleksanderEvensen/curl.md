import { ContextMenu } from '@base-ui/react/context-menu'
import { Link } from '@tanstack/react-router'
import wordmarkSvg from '#config/icons/brand/curlmd.svg?raw'
import { useCopyToClipboard } from '#hooks/useCopyToClipboard.ts'

const skipId = 'main'

function Group(props: React.PropsWithChildren) {
  return <div className="ms-auto flex items-center gap-1.5">{props.children}</div>
}

function Logo(props: { to?: '/' | '/docs'; variant?: 'icon' | 'text' }) {
  const clipboard = useCopyToClipboard()

  if (props.variant === 'icon')
    return (
      <LogoContextMenu copyWordmark={() => clipboard.copy(getWordmarkSvg())}>
        <Link
          aria-label="curl.md"
          className="text-gray10 inline-flex items-center"
          to={props.to ?? '/'}
        >
          <IconBrandCurlmd aria-hidden="true" className="h-3 w-auto" />
        </Link>
      </LogoContextMenu>
    )

  return (
    <LogoContextMenu copyWordmark={() => clipboard.copy(getWordmarkSvg())}>
      <Link className="font-pixel text-base" to={props.to ?? '/'}>
        curl.md<span className="text-gray8">/&lt;url&gt;</span>
      </Link>
    </LogoContextMenu>
  )
}

function Root(props: React.PropsWithChildren<{ fixed?: boolean }>) {
  return (
    <nav
      className={`flex h-17 items-center px-6 ${props.fixed ? 'bg-bg1 fixed inset-x-0 top-0 z-50' : ''}`}
    >
      {props.children ?? <Logo variant="icon" />}
    </nav>
  )
}

function Skip() {
  return (
    <a
      className="bg-gray10 text-bg1 rounded-0.5 sr-only z-60 text-sm focus:not-sr-only focus:fixed focus:start-6 focus:top-4 focus:block focus:px-3 focus:py-1.5"
      href={`#${skipId}`}
    >
      Skip to content
    </a>
  )
}

function LogoContextMenu(props: React.PropsWithChildren<{ copyWordmark: () => void }>) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={props.children as React.ReactElement} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-[100] outline-hidden">
          <ContextMenu.Popup className="bg-gray1 text-gray12 outline-gray5 rounded-0.5 min-w-64 origin-[var(--transform-origin)] p-1 text-sm shadow-lg outline-1 data-[ending-style]:opacity-0">
            <ContextMenu.Item
              className="data-[highlighted]:bg-gray3 rounded-0.5 flex cursor-default items-center gap-3 px-3 py-2 outline-hidden select-none"
              onClick={props.copyWordmark}
            >
              <span aria-hidden="true" className="text-gray8 w-4 text-center font-mono text-base">
                T
              </span>
              Copy Wordmark as SVG
            </ContextMenu.Item>
            <ContextMenu.Item
              className="data-[highlighted]:bg-gray3 rounded-0.5 flex cursor-default items-center gap-3 px-3 py-2 outline-hidden select-none"
              render={<Link params={{ _splat: 'brand' }} to="/docs/$" />}
            >
              <IconOcticonPaintbrush16 aria-hidden="true" className="text-gray8 size-4" />
              Brand Guidelines
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function getWordmarkSvg() {
  return wordmarkSvg
    .replaceAll('currentColor', resolveCssColor('--color-gray10'))
    .replaceAll('var(--color-gray8)', resolveCssColor('--color-gray8'))
}

function resolveCssColor(variableName: string) {
  if (typeof document === 'undefined') return '#000000'

  const element = document.createElement('span')
  element.style.color = `var(${variableName})`
  document.body.appendChild(element)
  const color = getComputedStyle(element).color
  element.remove()

  return toHexColor(color)
}

function toHexColor(color: string) {
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return color
  context.fillStyle = color
  return context.fillStyle
}

export const Nav = {
  Group,
  Logo,
  Root,
  Skip,
  skipId,
}
