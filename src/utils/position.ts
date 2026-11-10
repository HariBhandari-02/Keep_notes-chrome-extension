import type { PanelPosition, PanelSize } from '../types/note'

export const PANEL_WIDTH = 360
export const PANEL_HEIGHT = 470
export const PANEL_MIN_WIDTH = 300
export const PANEL_MIN_HEIGHT = 300
export const PANEL_MARGIN = 12

export type ResizeDirection =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'topRight'
  | 'bottomRight'
  | 'bottomLeft'
  | 'topLeft'

export interface ResizeLimits {
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
}

function hasDirection(direction: ResizeDirection, edge: 'left' | 'top'): boolean {
  return new RegExp(edge, 'i').test(direction)
}

export function clampPosition(
  position: PanelPosition,
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = PANEL_MARGIN
): PanelPosition {
  const maxX = Math.max(margin, viewportWidth - panelWidth - margin)
  const maxY = Math.max(margin, viewportHeight - panelHeight - margin)

  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  }
}

export function defaultPanelPosition(
  viewportWidth: number,
  viewportHeight: number,
  panelWidth = PANEL_WIDTH,
  panelHeight = PANEL_HEIGHT
): PanelPosition {
  const x = Math.max(PANEL_MARGIN, viewportWidth - panelWidth - 20)
  const y = Math.max(PANEL_MARGIN, Math.min(24, viewportHeight - panelHeight - PANEL_MARGIN))
  return clampPosition({ x, y }, panelWidth, panelHeight, viewportWidth, viewportHeight)
}

export function getPanelSize(
  viewportWidth: number,
  viewportHeight: number,
  preferredSize?: PanelSize | null
): PanelSize {
  const availableWidth = Math.max(0, viewportWidth - PANEL_MARGIN * 2)
  const availableHeight = Math.max(0, viewportHeight - PANEL_MARGIN * 2)
  const targetWidth = preferredSize?.width ?? PANEL_WIDTH
  const targetHeight = preferredSize?.height ?? PANEL_HEIGHT

  const width = Math.min(targetWidth, availableWidth)
  const height = Math.min(targetHeight, availableHeight)

  return {
    width: Math.max(Math.min(PANEL_MIN_WIDTH, availableWidth), width),
    height: Math.max(Math.min(PANEL_MIN_HEIGHT, availableHeight), height),
  }
}

/**
 * Constraints are measured from the opposite, fixed edge while resizing. This
 * keeps a panel anchored when the user drags its top or left handle.
 */
export function getResizeLimits(
  direction: ResizeDirection,
  position: PanelPosition,
  size: PanelSize,
  viewportWidth: number,
  viewportHeight: number,
  margin = PANEL_MARGIN
): ResizeLimits {
  const availableWidth = hasDirection(direction, 'left')
    ? position.x + size.width - margin
    : viewportWidth - position.x - margin
  const availableHeight = hasDirection(direction, 'top')
    ? position.y + size.height - margin
    : viewportHeight - position.y - margin
  const maxWidth = Math.max(1, Math.floor(availableWidth))
  const maxHeight = Math.max(1, Math.floor(availableHeight))

  return {
    minWidth: Math.min(PANEL_MIN_WIDTH, maxWidth),
    maxWidth,
    minHeight: Math.min(PANEL_MIN_HEIGHT, maxHeight),
    maxHeight,
  }
}

export function resizePanelPosition(
  direction: ResizeDirection,
  startPosition: PanelPosition,
  startSize: PanelSize,
  nextSize: PanelSize
): PanelPosition {
  return {
    x: hasDirection(direction, 'left')
      ? startPosition.x - (nextSize.width - startSize.width)
      : startPosition.x,
    y: hasDirection(direction, 'top')
      ? startPosition.y - (nextSize.height - startSize.height)
      : startPosition.y,
  }
}

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="textbox"]',
  '[data-no-drag]',
].join(',')

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false
  return Boolean((target as Element).closest(INTERACTIVE_SELECTOR))
}
