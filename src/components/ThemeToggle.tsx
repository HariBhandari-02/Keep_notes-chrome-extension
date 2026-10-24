import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '../types/note'
import { IconButton } from './IconButton'

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

interface ThemeToggleProps {
  theme: ThemeMode
  onChange: (theme: ThemeMode) => void
}

export function ThemeToggle({ theme, onChange }: Readonly<ThemeToggleProps>) {
  const next = NEXT_THEME[theme]
  const label = `Theme: ${LABELS[theme]}. Switch to ${LABELS[next].toLowerCase()}.`

  return (
    <IconButton
      label={label}
      size="sm"
      onClick={() => onChange(next)}
      className="text-neutral-400 dark:text-neutral-500"
    >
      {theme === 'system' && <Monitor size={14} strokeWidth={2} aria-hidden="true" />}
      {theme === 'light' && <Sun size={14} strokeWidth={2} aria-hidden="true" />}
      {theme === 'dark' && <Moon size={14} strokeWidth={2} aria-hidden="true" />}
    </IconButton>
  )
}
