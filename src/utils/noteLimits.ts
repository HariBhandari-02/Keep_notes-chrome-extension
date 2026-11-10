/**
 * Central limits for untrusted note data. These values are intentionally large
 * enough for normal note taking while bounding storage, rendering, and search.
 */
export const MAX_NOTE_CONTENT_LENGTH = 100_000
export const MAX_NOTE_TITLE_LENGTH = 200
export const MAX_NOTE_MARKS = 2_000
export const MAX_NOTE_ID_LENGTH = 128
export const MAX_PAGE_SELECTION_LENGTH = 50_000
export const MAX_SEARCH_QUERY_LENGTH = 200
export const MAX_LINK_URL_LENGTH = 2_048
export const MAX_PANEL_COORDINATE = 1_000_000
export const MAX_PANEL_DIMENSION = 10_000
export const MAX_TIMESTAMP = 8_640_000_000_000_000

const NOTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const RESERVED_NOTE_IDS = new Set(['__proto__', 'prototype', 'constructor'])

export function isValidNoteId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_NOTE_ID_LENGTH &&
    NOTE_ID_PATTERN.test(value) &&
    !RESERVED_NOTE_IDS.has(value)
  )
}

export function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

export function isSafeTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_TIMESTAMP
  )
}

export function isSafeCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_PANEL_COORDINATE
  )
}

export function isSafeDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_PANEL_DIMENSION
  )
}
