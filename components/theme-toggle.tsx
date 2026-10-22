'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Prevent hydration mismatch by deferring icon/label rendering until after client-side hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const visibleTheme = mounted ? theme : 'dark'
  const nextTheme = visibleTheme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {visibleTheme === 'dark' ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
    </button>
  )
}
