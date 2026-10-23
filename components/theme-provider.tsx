'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('ticketug-theme')
    if (stored === 'light' || stored === 'dark') {
      // The persisted preference is only available after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(stored)
    }
    setHasLoadedPreference(true)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (hasLoadedPreference) window.localStorage.setItem('ticketug-theme', theme)
  }, [hasLoadedPreference, theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((current) => current === 'dark' ? 'light' : 'dark'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
