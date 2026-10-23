import type { Note } from '../types/note'
import { deriveTitle } from './generateTitle'

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function normalizeNote(raw: unknown, now = Date.now()): Note | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return null
  if (typeof record.content !== 'string') return null

  const content = record.content
  const createdAt = isFiniteNumber(record.createdAt) ? record.createdAt : now
  const updatedAt = isFiniteNumber(record.updatedAt) ? record.updatedAt : createdAt
  const rawTitle = typeof record.title === 'string' ? record.title : ''
  const customTitle = record.customTitle === true && rawTitle.trim().length > 0

  return {
    id: record.id,
    title: customTitle ? rawTitle : deriveTitle(content),
    customTitle,
    content,
    createdAt,
    updatedAt,
  }
}

export function updateNoteContent(note: Note, content: string, now = Date.now()): Note {
  if (note.content === content) return note
  return {
    ...note,
    content,
    title: note.customTitle ? note.title : deriveTitle(content),
    updatedAt: now,
  }
}

export function updateNoteTitle(note: Note, title: string, now = Date.now()): Note {
  const customTitle = title.trim().length > 0
  return {
    ...note,
    title: customTitle ? title : deriveTitle(note.content),
    customTitle,
    updatedAt: now,
  }
}

export function displayTitle(note: Note): string {
  if (note.customTitle && note.title.trim().length > 0) return note.title
  return deriveTitle(note.content)
}

export function contentPreview(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim()
  return collapsed
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return notes
  return notes.filter((note) => {
    const title = displayTitle(note).toLocaleLowerCase()
    const content = note.content.toLocaleLowerCase()
    return title.includes(needle) || content.includes(needle)
  })
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
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
      year: new Date(timestamp).getFullYear() !== new Date(now).getFullYear() ? 'numeric' : undefined,
    }).format(timestamp)
  } catch {
    return new Date(timestamp).toLocaleDateString()
  }
}
