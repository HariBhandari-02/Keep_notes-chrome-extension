import { useEffect, useState } from 'react'
import type { ThemeMode } from '../types/note'

const QUERY = '(prefers-color-scheme: dark)'

export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => {
    if (!globalThis.window?.matchMedia) return false
    return globalThis.window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (!globalThis.window?.matchMedia) return
    const media = globalThis.window.matchMedia(QUERY)
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
