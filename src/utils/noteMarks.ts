import type { FormatMarkType, NoteMark, NoteMarkType, StyleMarkType } from '../types/note'
import { toLinkHref } from './linkUrl'
import { MAX_NOTE_MARKS } from './noteLimits'

export const FORMAT_MARK_TYPES: readonly FormatMarkType[] = ['bold', 'italic', 'underline']

const STYLE_MARK_TYPES: readonly StyleMarkType[] = [...FORMAT_MARK_TYPES, 'heading']

export const NOTE_MARK_TYPES: readonly NoteMarkType[] = [...STYLE_MARK_TYPES, 'link']

export interface TextSegment {
  text: string
  types: FormatMarkType[]
  /** Set when the run is covered by a link mark. */
  href?: string
  /** Set when the run is part of a heading line. */
  heading?: boolean
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
  const { type, start, end, href } = item as Record<string, unknown>
  if (!isMarkType(type) || !isOffset(start) || !isOffset(end)) return null

  const from = Math.min(start, contentLength)
  const to = Math.min(end, contentLength)
  if (from >= to) return null
  if (type !== 'link') return { type, start: from, end: to }

  const safeHref = toLinkHref(href)
  return safeHref ? { type, start: from, end: to, href: safeHref } : null
}

/** Merges overlapping or touching ranges of one type into sorted, disjoint marks. */
function mergeRanges(type: StyleMarkType, ranges: Array<[number, number]>): NoteMark[] {
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
 * Links only merge with the same URL. Where links to different URLs overlap, the
 * earlier one keeps the shared text so every character has at most one link.
 */
function mergeLinks(links: NoteMark[]): NoteMark[] {
  links.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: NoteMark[] = []
  for (const link of links) {
    const previous = merged.at(-1)
    if (previous && link.start <= previous.end && link.href === previous.href) {
      previous.end = Math.max(previous.end, link.end)
      continue
    }
    const start = previous ? Math.max(link.start, previous.end) : link.start
    if (start < link.end) merged.push({ ...link, start })
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

  const byType = new Map<StyleMarkType, Array<[number, number]>>()
  const links: NoteMark[] = []
  for (const item of raw.slice(0, MAX_NOTE_MARKS)) {
    const mark = toClampedMark(item, contentLength)
    if (!mark) continue
    if (mark.type === 'link') {
      links.push(mark)
      continue
    }
    const ranges = byType.get(mark.type) ?? []
    ranges.push([mark.start, mark.end])
    byType.set(mark.type, ranges)
  }

  return [
    ...STYLE_MARK_TYPES.flatMap((type) => mergeRanges(type, byType.get(type) ?? [])),
    ...mergeLinks(links),
  ]
}

export function marksEqual(a: readonly NoteMark[], b: readonly NoteMark[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (mark, index) =>
      mark.type === b[index].type &&
      mark.start === b[index].start &&
      mark.end === b[index].end &&
      mark.href === b[index].href
  )
}

interface MarkTrack {
  type: NoteMarkType
  marks: NoteMark[]
  cursor: number
}

/** Returns the track's mark covering [start, end), moving its cursor past marks that end before. */
function coveringMark(track: MarkTrack, start: number, end: number): NoteMark | undefined {
  while (track.cursor < track.marks.length && track.marks[track.cursor].end <= start) {
    track.cursor += 1
  }
  const mark = track.marks[track.cursor]
  return mark && mark.start <= start && mark.end >= end ? mark : undefined
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
  const tracks = NOTE_MARK_TYPES.map((type): MarkTrack => ({
    type,
    marks: marks.filter((mark) => mark.type === type),
    cursor: 0,
  }))

  const segments: TextSegment[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const segment: TextSegment = { text: content.slice(start, end), types: [] }
    for (const track of tracks) {
      const mark = coveringMark(track, start, end)
      if (!mark) continue
      if (track.type === 'link') segment.href = mark.href
      else if (track.type === 'heading') segment.heading = true
      else segment.types.push(track.type)
    }
    segments.push(segment)
  }
  return segments
}

/**
 * Headings style whole lines, so each heading mark is widened to the lines it
 * touches and split at line breaks. Empty lines are left out, as no range covers them.
 */
export function alignHeadingLines(content: string, marks: readonly NoteMark[]): NoteMark[] {
  const aligned = marks.filter((mark) => mark.type !== 'heading')
  // End of the last line taken, so two heading marks on one line add it once.
  let taken = 0
  for (const mark of marks) {
    if (mark.type !== 'heading') continue
    let start = Math.max(taken, mark.start === 0 ? 0 : content.lastIndexOf('\n', mark.start - 1) + 1)
    while (start < mark.end) {
      const newline = content.indexOf('\n', start)
      const end = newline === -1 ? content.length : newline
      if (end > start) aligned.push({ type: 'heading', start, end })
      start = end + 1
    }
    taken = Math.max(taken, start)
  }
  return aligned
}
