import type { NoteMark, NoteMarkType } from '../types/note'
import { MAX_NOTE_MARKS } from './noteLimits'

export const NOTE_MARK_TYPES: readonly NoteMarkType[] = ['bold', 'italic', 'underline']

export interface TextSegment {
  text: string
  types: NoteMarkType[]
}

function isMarkType(value: unknown): value is NoteMarkType {
  return NOTE_MARK_TYPES.includes(value as NoteMarkType)
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** Returns the mark clamped to the content, or null when it is malformed or empty. */
function toClampedMark(item: unknown, contentLength: number): NoteMark | null {
  if (typeof item !== 'object' || item === null) return null
  const { type, start, end } = item as Record<string, unknown>
  if (!isMarkType(type) || !isOffset(start) || !isOffset(end)) return null

  const from = Math.min(start, contentLength)
  const to = Math.min(end, contentLength)
  return from < to ? { type, start: from, end: to } : null
}

/** Merges overlapping or touching ranges of one type into sorted, disjoint marks. */
function mergeRanges(type: NoteMarkType, ranges: Array<[number, number]>): NoteMark[] {
  ranges.sort((a, b) => a[0] - b[0])
  const merged: NoteMark[] = []
  let current: NoteMark | null = null
  for (const [start, end] of ranges) {
    if (current && start <= current.end) {
      current.end = Math.max(current.end, end)
    } else {
      current = { type, start, end }
      merged.push(current)
    }
  }
  return merged
}

/**
 * Validates untrusted marks and returns a canonical list: ranges clamped to the
 * content, empty ranges dropped, and overlapping or touching ranges of the same
 * type merged. Output is ordered by type, then start offset.
 */
export function normalizeMarks(raw: unknown, contentLength: number): NoteMark[] {
  if (!Array.isArray(raw)) return []

  const byType = new Map<NoteMarkType, Array<[number, number]>>()
  for (const item of raw.slice(0, MAX_NOTE_MARKS)) {
    const mark = toClampedMark(item, contentLength)
    if (!mark) continue
    const ranges = byType.get(mark.type) ?? []
    ranges.push([mark.start, mark.end])
    byType.set(mark.type, ranges)
  }

  return NOTE_MARK_TYPES.flatMap((type) => mergeRanges(type, byType.get(type) ?? []))
}

export function marksEqual(a: readonly NoteMark[], b: readonly NoteMark[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (mark, index) =>
      mark.type === b[index].type && mark.start === b[index].start && mark.end === b[index].end
  )
}

/** Splits content into runs that share the same set of active marks. Expects normalized marks. */
export function buildSegments(content: string, marks: readonly NoteMark[]): TextSegment[] {
  const boundaries = new Set<number>([0, content.length])
  for (const mark of marks) {
    boundaries.add(mark.start)
    boundaries.add(mark.end)
  }
  const points = [...boundaries].filter((point) => point <= content.length).sort((a, b) => a - b)

  // Marks of one type are sorted and disjoint, so a forward-moving cursor per type finds the cover.
  const tracks = NOTE_MARK_TYPES.map((type) => ({
    type,
    marks: marks.filter((mark) => mark.type === type),
    cursor: 0,
  }))

  const segments: TextSegment[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const types: NoteMarkType[] = []
    for (const track of tracks) {
      while (track.cursor < track.marks.length && track.marks[track.cursor].end <= start) {
        track.cursor += 1
      }
      const mark = track.marks[track.cursor]
      if (mark && mark.start <= start && mark.end >= end) types.push(track.type)
    }
    segments.push({ text: content.slice(start, end), types })
  }
  return segments
}
