import { ContextMenu } from '@base-ui/react/context-menu'
import * as React from 'react'
import { useCopyToClipboard } from '#hooks/useCopyToClipboard.ts'

const storageKey = 'curl.md:sheep-variant'

const variants = [
  'cloud',
  'ember',
  'glacier',
  'lightning',
  'mint',
  'thunder',
  'violet',
  'voltage',
] as const

type Variant = (typeof variants)[number]

function Root(props: { className?: string }) {
  const { copy } = useCopyToClipboard()
  const isActive = React.useRef(false)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [variant, setVariant] = React.useState<Variant | undefined>(undefined)

  React.useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored && (variants as ReadonlyArray<string>).includes(stored)) {
      setVariant(stored as Variant)
      applySheepVariant(stored as Variant)
      return
    }
    applySheepVariant(
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'thunder' : 'cloud',
    )
  }, [])

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        aria-label="Change sheep variant"
        className={props.className}
        data-sheep=""
        data-sheep-animating={isAnimating ? '' : undefined}
        data-sheep-variant={variant}
        onAnimationIteration={() => {
          if (!isActive.current) setIsAnimating(false)
        }}
        onClick={() => {
          const currentIndex = variant === undefined ? -1 : variants.indexOf(variant)
          const next = variants[(currentIndex + 1) % variants.length]!
          setVariant(next)
          localStorage.setItem(storageKey, next)
          applySheepVariant(next)
        }}
        onBlur={() => {
          isActive.current = false
        }}
        onFocus={() => {
          isActive.current = true
          setIsAnimating(true)
        }}
        onMouseEnter={() => {
          isActive.current = true
          setIsAnimating(true)
        }}
        onMouseLeave={() => {
          isActive.current = false
        }}
        render={<button type="button" />}
      />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-[100] outline-hidden">
          <ContextMenu.Popup className="bg-gray1 text-gray12 outline-gray5 scrollbar-thumb-gray-a3 max-h-[var(--available-height)] min-w-48 origin-[var(--transform-origin)] scrollbar-thin scrollbar-track-transparent overflow-y-auto overscroll-contain p-1 text-sm shadow-lg outline-1 data-[ending-style]:opacity-0">
            <ContextMenu.RadioGroup
              value={variant ?? null}
              onValueChange={(value) => {
                setVariant(value as Variant)
                localStorage.setItem(storageKey, value)
                applySheepVariant(value as Variant)
              }}
            >
              {variants.map((variant) => (
                <ContextMenu.RadioItem
                  className="data-[highlighted]:bg-gray3 flex cursor-default items-center gap-3 px-3 py-2 outline-hidden select-none"
                  closeOnClick
                  key={variant}
                  value={variant}
                >
                  <span data-sheep-preview="" data-sheep-variant={variant} />
                  <span className="capitalize">{variant}</span>
                </ContextMenu.RadioItem>
              ))}
            </ContextMenu.RadioGroup>
            <ContextMenu.Separator className="bg-gray5 my-1 h-px" />
            <ContextMenu.Item
              className="data-[highlighted]:bg-gray3 flex cursor-default px-3 py-2 outline-hidden select-none"
              onClick={() =>
                window.open(getSheepStaticUrl(variant), '_blank', 'noopener,noreferrer')
              }
            >
              Open in new window
            </ContextMenu.Item>
            <ContextMenu.Item
              className="data-[highlighted]:bg-gray3 flex cursor-default px-3 py-2 outline-hidden select-none"
              onClick={() => copyStaticSheep(variant, copy)}
            >
              Copy to clipboard
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function getSheepStaticUrl(variant: Variant | undefined, absolute = false) {
  const path = `/sheep/static/${variant ?? 'cloud'}.png`
  if (!absolute || typeof window === 'undefined') return path
  return new URL(path, window.location.href).href
}

async function copyStaticSheep(
  variant: Variant | undefined,
  copy: (text?: string) => Promise<void>,
) {
  const url = getSheepStaticUrl(variant, true)
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
      return
    } catch {}
  }

  await copy(url)
}

function applySheepVariant(variant: Variant) {
  document.documentElement.dataset.sheepVariant = variant
}

export const sheepVariantScript = `
(function() {
  var variants = ${JSON.stringify(variants)};
  var query = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var stored = localStorage.getItem('${storageKey}');
    document.documentElement.dataset.sheepVariant =
      variants.indexOf(stored) === -1 ? (query.matches ? 'thunder' : 'cloud') : stored;
  }
  apply();
  query.addEventListener('change', function() {
    if (!localStorage.getItem('${storageKey}')) apply();
  });
})();
`

export const Sheep = { Root, variants }
