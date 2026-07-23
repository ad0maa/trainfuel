import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tf-theme'

function readStoredTheme(): Theme | null {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

// jsdom (Jest's test environment) doesn't implement matchMedia — guard so
// the hook degrades to 'light' there instead of throwing.
function supportsMatchMedia(): boolean {
  return typeof window.matchMedia === 'function'
}

function resolveDisplayedTheme(explicit: Theme | null): Theme {
  if (explicit) return explicit
  if (!supportsMatchMedia()) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// Tracks the user's explicit choice (persisted) and the theme actually
// displayed (falls back to the OS preference when no explicit choice has
// been made) — mirrors tokens.css's `:root[data-theme]` / `prefers-color-scheme`
// precedence so this hook never fights the CSS.
export function useTheme() {
  const [explicitTheme, setExplicitTheme] = useState<Theme | null>(() =>
    readStoredTheme()
  )
  const [theme, setThemeState] = useState<Theme>(() =>
    resolveDisplayedTheme(explicitTheme)
  )

  useEffect(() => {
    if (explicitTheme) {
      document.documentElement.dataset.theme = explicitTheme
    } else {
      delete document.documentElement.dataset.theme
    }
    setThemeState(resolveDisplayedTheme(explicitTheme))
  }, [explicitTheme])

  useEffect(() => {
    if (explicitTheme || !supportsMatchMedia()) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setThemeState(resolveDisplayedTheme(null))
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [explicitTheme])

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setExplicitTheme(next)
  }, [])

  return { theme, setTheme }
}
