import * as React from 'react'

export function useAnimatedValue(
  target: number,
  options?: { delay?: number; duration?: number; from?: 'previous' | 'zero' },
) {
  const { delay = 0, duration = 600, from = 'zero' } = options ?? {}
  const prev = React.useRef(from === 'previous' ? target : 0)
  const [value, setValue] = React.useState(from === 'previous' ? target : 0)

  React.useEffect(() => {
    if (from === 'previous' && target === 0) return
    const origin = from === 'zero' ? 0 : prev.current
    prev.current = target

    let cancelled = false
    const timeout = setTimeout(() => {
      let start: number | null = null

      function tick(now: number) {
        if (cancelled) return
        start ??= now
        const t = Math.min((now - start) / duration, 1)
        const eased = 1 - (1 - t) ** 3
        setValue(origin + (target - origin) * eased)
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [target, delay, duration, from])

  return value
}
