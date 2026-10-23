import { useEffect, useState } from 'react'
import type { ThemeMode } from '../types/note'

const QUERY = '(prefers-color-scheme: dark)'

export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(QUERY)
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    setPrefersDark(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return prefersDark
}

export function useResolvedTheme(theme: ThemeMode): { isDark: boolean; prefersDark: boolean } {
  const prefersDark = usePrefersDark()
  return {
    prefersDark,
    isDark: theme === 'dark' || (theme === 'system' && prefersDark),
  }
}
