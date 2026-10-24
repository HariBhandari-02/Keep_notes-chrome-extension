import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { PanelPosition } from '../types/note'
import { PANEL_HEIGHT, PANEL_WIDTH, clampPosition, isInteractiveTarget } from '../utils/position'

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  panelWidth: number
  panelHeight: number
  previousUserSelect: string
  previousCursor: string
}

interface UseDraggableOptions {
  panelRef: RefObject<HTMLElement | null>
  initialPosition: PanelPosition
  onDragEnd: (position: PanelPosition) => void
}

export function useDraggable({ panelRef, initialPosition, onDragEnd }: UseDraggableOptions) {
  const [position, setPosition] = useState<PanelPosition>(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const positionRef = useRef(initialPosition)
  const dragRef = useRef<DragState | null>(null)

  const applyPosition = useCallback(
    (next: PanelPosition): PanelPosition => {
      const rect = panelRef.current?.getBoundingClientRect()
      const clamped = clampPosition(
        next,
        rect?.width ?? PANEL_WIDTH,
        rect?.height ?? PANEL_HEIGHT,
        globalThis.innerWidth,
        globalThis.innerHeight
      )
      positionRef.current = clamped
      setPosition(clamped)
      return clamped
    },
    [panelRef]
  )

  const reclamp = useCallback(() => {
    applyPosition(positionRef.current)
  }, [applyPosition])

  const getPosition = useCallback(() => positionRef.current, [])

  const moveTo = useCallback((next: PanelPosition) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  const commitPosition = useCallback(() => {
    onDragEnd(positionRef.current)
  }, [onDragEnd])

  const restorePageStyles = useCallback((drag: DragState) => {
    document.body.style.userSelect = drag.previousUserSelect
    document.body.style.cursor = drag.previousCursor
  }, [])

  const finishDrag = useCallback(
    (pointerId?: number, shouldPersist = true) => {
      const drag = dragRef.current
      if (!drag) return
      if (typeof pointerId === 'number' && drag.pointerId !== pointerId) return

      dragRef.current = null
      setIsDragging(false)
      restorePageStyles(drag)

      if (shouldPersist) {
        onDragEnd(positionRef.current)
      }
    },
    [onDragEnd, restorePageStyles]
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return
      const panel = panelRef.current
      if (!panel) return

      const rect = panel.getBoundingClientRect()
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: positionRef.current.x,
        originY: positionRef.current.y,
        panelWidth: rect.width,
        panelHeight: rect.height,
        previousUserSelect: document.body.style.userSelect,
        previousCursor: document.body.style.cursor,
      }

      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      setIsDragging(true)
    },
    [panelRef]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (drag?.pointerId !== event.pointerId) return

      const next = clampPosition(
        {
          x: drag.originX + (event.clientX - drag.startX),
          y: drag.originY + (event.clientY - drag.startY),
        },
        drag.panelWidth,
        drag.panelHeight,
        globalThis.innerWidth,
        globalThis.innerHeight
      )

      positionRef.current = next
      setPosition(next)
    },
    []
  )

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current
      if (drag?.pointerId !== event.pointerId) return
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      finishDrag(event.pointerId)
    },
    [finishDrag]
  )

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishDrag(event.pointerId)
    },
    [finishDrag]
  )

  useEffect(() => {
    const handleResize = () => reclamp()
    globalThis.addEventListener('resize', handleResize)
    return () => globalThis.removeEventListener('resize', handleResize)
  }, [reclamp])

  useEffect(() => {
    return () => {
      const drag = dragRef.current
      if (drag) restorePageStyles(drag)
    }
  }, [restorePageStyles])

  return {
    position,
    isDragging,
    reclamp,
    getPosition,
    moveTo,
    commitPosition,
    headerDragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}

export type HeaderDragProps = ReturnType<typeof useDraggable>['headerDragProps']
