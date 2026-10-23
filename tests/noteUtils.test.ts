import { describe, expect, it } from 'vitest'
import type { Note } from '../src/types/note'
import {
  contentPreview,
  createBlankNote,
  filterNotes,
  normalizeNote,
  updateNoteContent,
  updateNoteTitle,
} from '../src/utils/noteUtils'

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Original',
    customTitle: false,
    content: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('normalizeNote', () => {
  it('rejects malformed notes', () => {
    expect(normalizeNote(null)).toBeNull()
    expect(normalizeNote({})).toBeNull()
    expect(normalizeNote({ id: 42, content: 'hello' })).toBeNull()
    expect(normalizeNote({ id: 'ok', content: 42 })).toBeNull()
  })

  it('derives a title for notes without a custom title', () => {
    const normalized = normalizeNote({
      id: 'auto',
      title: 'stale title',
      customTitle: false,
      content: 'Fresh first line\nmore',
      createdAt: 10,
      updatedAt: 20,
    })
    expect(normalized?.title).toBe('Fresh first line')
  })

  it('preserves an explicitly set custom title', () => {
    const normalized = normalizeNote({
      id: 'custom',
      title: 'My custom title',
      customTitle: true,
      content: 'Some content',
      createdAt: 10,
      updatedAt: 20,
    })
    expect(normalized?.title).toBe('My custom title')
    expect(normalized?.customTitle).toBe(true)
  })

  it('treats a blank custom title as automatic', () => {
    const normalized = normalizeNote({
      id: 'blank',
      title: '   ',
      customTitle: true,
      content: 'Content title',
    })
    expect(normalized?.customTitle).toBe(false)
    expect(normalized?.title).toBe('Content title')
  })
})

describe('title updates', () => {
  it('updates an automatic title when content changes', () => {
    const initial = note({ content: 'First thought' , title: 'First thought' })
    const updated = updateNoteContent(initial, 'A better first line', 5)
    expect(updated.title).toBe('A better first line')
    expect(updated.content).toBe('A better first line')
    expect(updated.updatedAt).toBe(5)
  })

  it('does not overwrite a custom title when content changes', () => {
    const initial = note({ title: 'Pinned title', customTitle: true, content: 'old' })
    const updated = updateNoteContent(initial, 'new content', 5)
    expect(updated.title).toBe('Pinned title')
    expect(updated.customTitle).toBe(true)
  })

  it('resumes automatic titles when a custom title is cleared', () => {
    const initial = note({
      title: 'Pinned title',
      customTitle: true,
      content: 'Derived from content',
    })
    const cleared = updateNoteTitle(initial, '   ', 10)
    expect(cleared.customTitle).toBe(false)
    expect(cleared.title).toBe('Derived from content')
    expect(cleared.updatedAt).toBe(10)
  })

  it('marks a typed title as custom', () => {
    const updated = updateNoteTitle(note({ content: 'body' }), 'My title', 10)
    expect(updated.customTitle).toBe(true)
    expect(updated.title).toBe('My title')
  })
})

describe('filterNotes', () => {
  const notes = [
    note({
      id: 'a',
      title: 'Chrome extension ideas',
      customTitle: true,
      content: 'Use the scripting API',
    }),
    note({ id: 'b', title: 'Groceries', customTitle: true, content: 'Milk, eggs, Bread' }),
    note({ id: 'c', content: 'Read about manifest v3 permissions' }),
  ]

  it('returns all notes for an empty query', () => {
    expect(filterNotes(notes, '   ')).toHaveLength(3)
  })

  it('matches titles and content case-insensitively', () => {
    expect(filterNotes(notes, 'CHROME').map((item) => item.id)).toEqual(['a'])
    expect(filterNotes(notes, 'bread').map((item) => item.id)).toEqual(['b'])
    expect(filterNotes(notes, 'MANIFEST').map((item) => item.id)).toEqual(['c'])
  })

  it('does not mutate the note collection', () => {
    const before = notes.map((item) => ({ ...item }))
    filterNotes(notes, 'chrome')
    expect(notes).toEqual(before)
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterNotes(notes, 'zzz-not-found')).toEqual([])
  })
})

describe('helpers', () => {
  it('creates unique blank notes', () => {
    const first = createBlankNote(1)
    const second = createBlankNote(1)
    expect(first.id).not.toBe(second.id)
    expect(first.title).toBe('Untitled note')
    expect(first.content).toBe('')
  })

  it('builds compact previews', () => {
    expect(contentPreview('line one\n\n  line two  ')).toBe('line one line two')
    expect(contentPreview('   ')).toBe('')
  })
})
