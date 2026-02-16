import * as React from 'react'

export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'theme'

export function useTheme() {
  const [theme, setThemeState] = React.useState<Theme>('system')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setThemeState(getStoredTheme())
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
    setStoredTheme(theme)
  }, [theme, mounted])

  const [systemTheme, setSystemTheme] =
    React.useState<Exclude<Theme, 'system'>>(getSystemTheme)

  React.useEffect(() => {
    if (!mounted) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      const next = mediaQuery.matches ? 'dark' : 'light'
      setSystemTheme(next)
      if (getStoredTheme() === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mounted])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const cycle = React.useCallback(() => {
    setThemeState((current) => {
      if (current === 'system') return 'light'
      if (current === 'light') return 'dark'
      return 'system'
    })
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const label = theme === 'system' ? `system (${resolvedTheme})` : theme

  return { theme, resolvedTheme, label, mounted, setTheme, cycle } as const
}

function getSystemTheme(): Exclude<Theme, 'system'> {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  return (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'system'
}

function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  disableTransitions(() => {
    document.documentElement.dataset.theme = resolved
  })
}

function disableTransitions(callback: () => void) {
  const css = document.createElement('style')
  css.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}',
    ),
  )
  document.head.appendChild(css)

  callback()

  // Force repaint
  ;(() => window.getComputedStyle(document.body))()

  // Wait for next frame before removing
  setTimeout(() => {
    document.head.removeChild(css)
  }, 1)
}

// Inline script to prevent flash - runs before React hydrates
export const themeScript = `
(function() {
  var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
  var resolved = theme;
  if (theme === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = resolved;
})();
`
