// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '../src/components/ThemeToggle'
import { usePrefersDark } from '../src/hooks/useTheme'

describe('theme', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the system preference and reacts to changes', () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = []
    const media = {
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener)
      }),
      removeEventListener: vi.fn(),
    }
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia

    try {
      const { result } = renderHook(() => usePrefersDark())
      expect(result.current).toBe(true)

      act(() => {
        for (const listener of listeners) {
          listener({ matches: false } as MediaQueryListEvent)
        }
      })
      expect(result.current).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })

  it('cycles the theme when clicked', () => {
    const onChange = vi.fn()
    render(<ThemeToggle theme="system" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /Theme: System/ }))
    expect(onChange).toHaveBeenCalledWith('light')
  })
})
