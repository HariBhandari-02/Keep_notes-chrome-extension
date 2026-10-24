// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDraggable } from '../src/hooks/useDraggable'
import type { PanelPosition } from '../src/types/note'

function setup(initialPosition: PanelPosition = { x: 20, y: 20 }) {
  const panel = {
    getBoundingClientRect: () => ({ width: 300, height: 400 }),
  }
  const panelRef = { current: panel as unknown as HTMLElement }
  const onDragEnd = vi.fn()

  const view = renderHook(() => useDraggable({ panelRef, initialPosition, onDragEnd }))
  return { ...view, panelRef, onDragEnd }
}

function pointerEvent(overrides: Record<string, unknown> = {}) {
  const currentTarget = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
  }
  return {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    target: document.body,
    currentTarget,
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('useDraggable', () => {
  it('drags the panel and persists the final position', () => {
    const { result, onDragEnd } = setup()

    act(() => {
      result.current.headerDragProps.onPointerDown(
        pointerEvent() as unknown as React.PointerEvent<HTMLElement>
      )
    })
    expect(result.current.isDragging).toBe(true)
    expect(document.body.style.userSelect).toBe('none')

    act(() => {
      result.current.headerDragProps.onPointerMove(
        pointerEvent({ clientX: 160, clientY: 140 }) as unknown as React.PointerEvent<HTMLElement>
      )
    })
    expect(result.current.position).toEqual({ x: 80, y: 60 })

    act(() => {
      result.current.headerDragProps.onPointerUp(
        pointerEvent({ clientX: 160, clientY: 140 }) as unknown as React.PointerEvent<HTMLElement>
      )
    })

    expect(result.current.isDragging).toBe(false)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 80, y: 60 })
    expect(document.body.style.userSelect).toBe('')
  })

  it('ignores non-primary buttons and interactive targets', () => {
    const { result } = setup()
    const interactive = document.createElement('button')
    document.body.appendChild(interactive)

    act(() => {
      result.current.headerDragProps.onPointerDown(
        pointerEvent({ button: 2 }) as unknown as React.PointerEvent<HTMLElement>
      )
      result.current.headerDragProps.onPointerDown(
        pointerEvent({ target: interactive }) as unknown as React.PointerEvent<HTMLElement>
      )
    })

    expect(result.current.isDragging).toBe(false)
    interactive.remove()
  })

  it('ignores pointer events from another pointer id', () => {
    const { result, onDragEnd } = setup()

    act(() => {
      result.current.headerDragProps.onPointerDown(
        pointerEvent() as unknown as React.PointerEvent<HTMLElement>
      )
      result.current.headerDragProps.onPointerMove(
        pointerEvent({ pointerId: 2 }) as unknown as React.PointerEvent<HTMLElement>
      )
      result.current.headerDragProps.onPointerUp(
        pointerEvent({ pointerId: 2 }) as unknown as React.PointerEvent<HTMLElement>
      )
    })

    expect(result.current.position).toEqual({ x: 20, y: 20 })
    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('finishes a drag on pointer cancel', () => {
    const { result, onDragEnd } = setup()

    act(() => {
      result.current.headerDragProps.onPointerDown(
        pointerEvent() as unknown as React.PointerEvent<HTMLElement>
      )
      result.current.headerDragProps.onPointerCancel(
        pointerEvent() as unknown as React.PointerEvent<HTMLElement>
      )
    })

    expect(result.current.isDragging).toBe(false)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 20, y: 20 })
  })

  it('restores page styles when unmounted mid-drag', () => {
    const { result, unmount } = setup()

    act(() => {
      result.current.headerDragProps.onPointerDown(
        pointerEvent() as unknown as React.PointerEvent<HTMLElement>
      )
    })
    expect(document.body.style.cursor).toBe('grabbing')

    unmount()
    expect(document.body.style.cursor).toBe('')
  })

  it('moves and commits positions directly', () => {
    const { result, onDragEnd } = setup()

    act(() => {
      result.current.moveTo({ x: 50, y: 60 })
    })
    expect(result.current.position).toEqual({ x: 50, y: 60 })

    act(() => {
      result.current.commitPosition()
    })
    expect(onDragEnd).toHaveBeenCalledWith({ x: 50, y: 60 })

    act(() => {
      result.current.reclamp()
    })
    expect(result.current.position).toEqual({ x: 50, y: 60 })
  })
})
