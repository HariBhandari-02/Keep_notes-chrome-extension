import type { Note, NoteMark } from '../types/note'
import { deriveTitle } from './generateTitle'
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  clampText,
  isSafeTimestamp,
  isValidNoteId,
} from './noteLimits'
import { marksEqual, normalizeMarks } from './noteMarks'

const MAX_PREVIEW_LENGTH = 280

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeTimestamp(value: unknown, fallback: number): number {
  return isSafeTimestamp(value) ? value : fallback
}

function withMarks(note: Note, marks: NoteMark[]): Note {
  if (marks.length > 0) return { ...note, marks }
  const { marks: _omitted, ...plain } = note
  return plain
}

export function normalizeNote(raw: unknown, now = Date.now()): Note | null {
  if (!isRecord(raw)) return null
  if (!isValidNoteId(raw.id)) return null
  if (typeof raw.content !== 'string') return null

  const content = clampText(raw.content, MAX_NOTE_CONTENT_LENGTH)
  const createdAt = safeTimestamp(raw.createdAt, now)
  const updatedAt = safeTimestamp(raw.updatedAt, createdAt)
  const rawTitle =
    typeof raw.title === 'string' ? clampText(raw.title, MAX_NOTE_TITLE_LENGTH) : ''
  const customTitle = raw.customTitle === true && rawTitle.trim().length > 0

  const note: Note = {
    id: raw.id,
    title: customTitle ? rawTitle : deriveTitle(content),
    customTitle,
    content,
    createdAt,
    updatedAt,
  }
  if (raw.pinned === true) note.pinned = true
  return withMarks(note, normalizeMarks(raw.marks, content.length))
}

/** Bumps `updatedAt` so other tabs accept the change when merging. */
export function setNotePinned(note: Note, pinned: boolean, now = Date.now()): Note {
  if ((note.pinned === true) === pinned) return note
  const { pinned: _omitted, ...rest } = note
  return pinned ? { ...rest, pinned: true, updatedAt: now } : { ...rest, updatedAt: now }
}

/** Omitting `marks` keeps the note's existing formatting, clamped to the new content. */
export function updateNoteContent(
  note: Note,
  content: string,
  marks: readonly NoteMark[] = note.marks ?? [],
  now = Date.now()
): Note {
  const nextContent = clampText(content, MAX_NOTE_CONTENT_LENGTH)
  const nextMarks = normalizeMarks(marks, nextContent.length)
  if (note.content === nextContent && marksEqual(note.marks ?? [], nextMarks)) return note
  return withMarks(
    {
      ...note,
      content: nextContent,
      title: note.customTitle ? note.title : deriveTitle(nextContent),
      updatedAt: now,
    },
    nextMarks
  )
}

export function updateNoteTitle(note: Note, title: string, now = Date.now()): Note {
  const nextTitle = clampText(title, MAX_NOTE_TITLE_LENGTH)
  const customTitle = nextTitle.trim().length > 0
  return {
    ...note,
    title: customTitle ? nextTitle : deriveTitle(note.content),
    customTitle,
    updatedAt: now,
  }
}

export function displayTitle(note: Note): string {
  if (note.customTitle && note.title.trim().length > 0) return note.title
  return deriveTitle(note.content)
}

export function contentPreview(content: string): string {
  const sample =
    content.length > MAX_PREVIEW_LENGTH ? content.slice(0, MAX_PREVIEW_LENGTH) : content
  const collapsed = sample.replaceAll(/\s+/g, ' ').trim()
  return collapsed
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const needle = clampText(query.trim(), MAX_SEARCH_QUERY_LENGTH).toLocaleLowerCase()
  if (!needle) return notes
  return notes.filter((note) => {
    const title = displayTitle(note).toLocaleLowerCase()
    const content = note.content.toLocaleLowerCase()
    return title.includes(needle) || content.includes(needle)
  })
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true) || b.updatedAt - a.updatedAt
  )
}

export function createBlankNote(now = Date.now()): Note {
  return {
    id: createNoteId(),
    title: deriveTitle(''),
    customTitle: false,
    content: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function createNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const random = Math.random().toString(36).slice(2)
  const time = Date.now().toString(36)
  return `note-${time}-${random}`
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < 45 * 1000) return 'just now'
  if (diff < hour) {
    const minutes = Math.max(1, Math.round(diff / minute))
    return `${minutes}m ago`
  }
  if (diff < day) {
    const hours = Math.max(1, Math.round(diff / hour))
    return `${hours}h ago`
  }
  if (diff < 7 * day) {
    const days = Math.max(1, Math.round(diff / day))
    return days === 1 ? 'yesterday' : `${days}d ago`
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: new Date(timestamp).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
    }).format(timestamp)
  } catch {
    return new Date(timestamp).toLocaleDateString()
  }
}
