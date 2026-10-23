import { describe, expect, it } from 'vitest'
import {
  PANEL_HEIGHT,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  PANEL_WIDTH,
  clampPosition,
  defaultPanelPosition,
  getPanelSize,
  getResizeLimits,
  isInteractiveTarget,
  resizePanelPosition,
} from '../src/utils/position'

describe('clampPosition', () => {
  it('keeps a panel inside the viewport', () => {
    const position = clampPosition({ x: 5000, y: 5000 }, PANEL_WIDTH, PANEL_HEIGHT, 1200, 800)
    expect(position.x).toBe(1200 - PANEL_WIDTH - 12)
    expect(position.y).toBe(800 - PANEL_HEIGHT - 12)
  })

  it('prevents negative positions', () => {
    expect(clampPosition({ x: -100, y: -50 }, PANEL_WIDTH, PANEL_HEIGHT, 1200, 800)).toEqual({
      x: 12,
      y: 12,
    })
  })

  it('handles a viewport smaller than the panel', () => {
    const position = clampPosition({ x: 40, y: 40 }, 360, 470, 320, 280)
    expect(position).toEqual({ x: 12, y: 12 })
  })
})

describe('panel sizing', () => {
  it('uses the preferred size on a normal viewport', () => {
    expect(getPanelSize(1440, 900)).toEqual({ width: PANEL_WIDTH, height: PANEL_HEIGHT })
  })

  it('shrinks to fit a small viewport', () => {
    expect(getPanelSize(320, 300)).toEqual({ width: 296, height: 276 })
  })

  it('positions the default panel in the top-right corner', () => {
    const position = defaultPanelPosition(1200, 800)
    expect(position.x).toBe(1200 - PANEL_WIDTH - 20)
    expect(position.y).toBe(24)
  })

  it('restores a saved size when it fits the viewport', () => {
    expect(getPanelSize(1200, 800, { width: 520, height: 620 })).toEqual({
      width: 520,
      height: 620,
    })
  })

  it('clamps a saved size to the viewport and minimum dimensions', () => {
    expect(getPanelSize(800, 600, { width: 1200, height: 900 })).toEqual({
      width: 776,
      height: 576,
    })
    expect(getPanelSize(1200, 800, { width: 120, height: 120 })).toEqual({
      width: PANEL_MIN_WIDTH,
      height: PANEL_MIN_HEIGHT,
    })
  })
})

describe('resize constraints', () => {
  it('measures right and bottom handles from the panel position', () => {
    expect(
      getResizeLimits('bottomRight', { x: 100, y: 80 }, { width: 360, height: 470 }, 1200, 800)
    ).toEqual({
      minWidth: PANEL_MIN_WIDTH,
      maxWidth: 1088,
      minHeight: PANEL_MIN_HEIGHT,
      maxHeight: 708,
    })
  })

  it('measures left and top handles from the opposite edges', () => {
    expect(
      getResizeLimits('topLeft', { x: 100, y: 80 }, { width: 360, height: 470 }, 1200, 800)
    ).toEqual({
      minWidth: PANEL_MIN_WIDTH,
      maxWidth: 448,
      minHeight: PANEL_MIN_HEIGHT,
      maxHeight: 538,
    })
  })

  it('keeps the opposite edge fixed when resizing from left or top', () => {
    expect(
      resizePanelPosition(
        'topLeft',
        { x: 100, y: 80 },
        { width: 360, height: 470 },
        { width: 420, height: 520 }
      )
    ).toEqual({ x: 40, y: 30 })
  })

  it('does not move the panel when resizing from right or bottom', () => {
    expect(
      resizePanelPosition(
        'bottomRight',
        { x: 100, y: 80 },
        { width: 360, height: 470 },
        { width: 420, height: 520 }
      )
    ).toEqual({ x: 100, y: 80 })
  })

  it('reduces minimum constraints on very small viewports', () => {
    expect(
      getResizeLimits(
        'bottomRight',
        { x: 12, y: 12 },
        { width: 296, height: 276 },
        320,
        300
      )
    ).toEqual({
      minWidth: 296,
      maxWidth: 296,
      minHeight: 276,
      maxHeight: 276,
    })
  })
})

describe('isInteractiveTarget', () => {
  it('returns false for missing targets', () => {
    expect(isInteractiveTarget(null)).toBe(false)
    expect(isInteractiveTarget({} as EventTarget)).toBe(false)
  })

  it('detects interactive controls via closest()', () => {
    const button = { closest: () => ({ tagName: 'BUTTON' }) } as unknown as EventTarget
    const blank = { closest: () => null } as unknown as EventTarget
    expect(isInteractiveTarget(button)).toBe(true)
    expect(isInteractiveTarget(blank)).toBe(false)
  })
})
