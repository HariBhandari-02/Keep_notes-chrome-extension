import { describe, expect, it, vi } from 'vitest'
import type { Note } from '../src/types/note'
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
  isValidNoteId,
} from '../src/utils/noteLimits'
import {
  contentPreview,
  createBlankNote,
  createNoteId,
  filterNotes,
  formatRelativeTime,
  normalizeNote,
  setNotePinned,
  sortNotes,
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

  it('rejects invalid and prototype-polluting note ids', () => {
    for (const id of [
      '',
      ' ',
      '__proto__',
      'constructor',
      'prototype',
      'has spaces',
      '../escape',
      'a'.repeat(129),
      '../keepnotes:settings',
    ]) {
      expect(normalizeNote({ id, content: 'body' })).toBeNull()
      expect(isValidNoteId(id)).toBe(false)
    }
  })

  it('sanitizes malformed timestamps', () => {
    const normalized = normalizeNote(
      {
        id: 'timestamps',
        content: 'body',
        createdAt: Number.NaN,
        updatedAt: -1,
      },
      1234
    )

    expect(normalized?.createdAt).toBe(1234)
    expect(normalized?.updatedAt).toBe(1234)
  })

  it('clamps oversized stored content and titles', () => {
    const normalized = normalizeNote({
      id: 'huge',
      title: 't'.repeat(MAX_NOTE_TITLE_LENGTH + 50),
      customTitle: true,
      content: 'c'.repeat(MAX_NOTE_CONTENT_LENGTH + 50),
    })

    expect(normalized?.title).toHaveLength(MAX_NOTE_TITLE_LENGTH)
    expect(normalized?.content).toHaveLength(MAX_NOTE_CONTENT_LENGTH)
  })
})

describe('title updates', () => {
  it('updates an automatic title when content changes', () => {
    const initial = note({ content: 'First thought' , title: 'First thought' })
    const updated = updateNoteContent(initial, 'A better first line', [], 5)
    expect(updated.title).toBe('A better first line')
    expect(updated.content).toBe('A better first line')
    expect(updated.updatedAt).toBe(5)
  })

  it('does not overwrite a custom title when content changes', () => {
    const initial = note({ title: 'Pinned title', customTitle: true, content: 'old' })
    const updated = updateNoteContent(initial, 'new content', [], 5)
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

  it('clamps direct content and title updates to storage limits', () => {
    const largeContent = 'c'.repeat(MAX_NOTE_CONTENT_LENGTH + 100)
    const contentUpdated = updateNoteContent(note(), largeContent)
    expect(contentUpdated.content).toHaveLength(MAX_NOTE_CONTENT_LENGTH)

    const largeTitle = 't'.repeat(MAX_NOTE_TITLE_LENGTH + 100)
    const titleUpdated = updateNoteTitle(note(), largeTitle)
    expect(titleUpdated.title).toHaveLength(MAX_NOTE_TITLE_LENGTH)
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

  it('bounds preview work for very large notes', () => {
    const preview = contentPreview(`start ${'x'.repeat(MAX_NOTE_CONTENT_LENGTH)}`)
    expect(preview.length).toBeLessThanOrEqual(280)
  })

  it('returns the same note when content is unchanged', () => {
    const original = note({ content: 'same' })
    expect(updateNoteContent(original, 'same')).toBe(original)
  })

  it('sorts notes by most recently updated', () => {
    const older = note({ id: 'older', updatedAt: 1 })
    const newer = note({ id: 'newer', updatedAt: 10 })
    expect(sortNotes([older, newer]).map((item) => item.id)).toEqual(['newer', 'older'])
  })

  it('sorts pinned notes before newer unpinned notes', () => {
    const pinned = note({ id: 'pinned', updatedAt: 1, pinned: true })
    const newer = note({ id: 'newer', updatedAt: 10 })
    expect(sortNotes([newer, pinned]).map((item) => item.id)).toEqual(['pinned', 'newer'])
  })

  it('pins and unpins notes, omitting the flag when unpinned', () => {
    const original = note()
    const pinned = setNotePinned(original, true, 50)
    expect(pinned).toMatchObject({ pinned: true, updatedAt: 50 })
    expect(setNotePinned(pinned, true)).toBe(pinned)

    const unpinned = setNotePinned(pinned, false, 60)
    expect('pinned' in unpinned).toBe(false)
    expect(unpinned.updatedAt).toBe(60)
  })

  it('keeps only a literal true pinned flag when normalizing', () => {
    expect(normalizeNote({ id: 'a', content: '', pinned: true })?.pinned).toBe(true)
    expect('pinned' in (normalizeNote({ id: 'a', content: '', pinned: 'yes' }) ?? {})).toBe(false)
  })

  it('creates ids without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {})
    try {
      expect(createNoteId()).toMatch(/^note-/)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('formats recent times as relative labels', () => {
    const now = 1_000_000_000
    expect(formatRelativeTime(now - 10_000, now)).toBe('just now')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago')
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe('3h ago')
    expect(formatRelativeTime(now - 24 * 60 * 60_000, now)).toBe('yesterday')
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60_000, now)).toBe('3d ago')
  })

  it('formats older dates with an absolute date', () => {
    const now = new Date('2026-06-15T12:00:00Z').getTime()
    const old = new Date('2024-01-10T12:00:00Z').getTime()
    const formatted = formatRelativeTime(old, now)
    expect(formatted).toContain('2024')
  })

  it('falls back when date formatting throws', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementationOnce(() => {
      throw new Error('no intl')
    })
    const now = new Date('2026-06-15T12:00:00Z').getTime()
    const old = new Date('2024-01-10T12:00:00Z').getTime()

    expect(formatRelativeTime(old, now).length).toBeGreaterThan(0)
    spy.mockRestore()
  })
})

describe('note formatting marks', () => {
  it('normalizes stored marks and omits them when there are none', () => {
    const formatted = normalizeNote({
      ...note({ content: 'Bold text' }),
      marks: [
        { type: 'bold', start: 0, end: 4 },
        { type: 'script', start: 0, end: 4 },
        { type: 'italic', start: 5, end: 500 },
      ],
    })
    expect(formatted?.marks).toEqual([
      { type: 'bold', start: 0, end: 4 },
      { type: 'italic', start: 5, end: 9 },
    ])

    const plain = normalizeNote({ ...note({ content: 'Plain' }), marks: 'nope' })
    expect(plain).not.toHaveProperty('marks')
  })

  it('replaces marks when the editor provides them', () => {
    const original = note({ content: 'abc' })
    const updated = updateNoteContent(original, 'abc', [{ type: 'underline', start: 1, end: 3 }], 7)
    expect(updated).not.toBe(original)
    expect(updated.marks).toEqual([{ type: 'underline', start: 1, end: 3 }])
    expect(updated.updatedAt).toBe(7)
  })

  it('keeps existing marks when only the content changes', () => {
    const original = note({ content: 'abc', marks: [{ type: 'bold', start: 0, end: 3 }] })
    const updated = updateNoteContent(original, 'abc\n\nappended')
    expect(updated.marks).toEqual([{ type: 'bold', start: 0, end: 3 }])
  })

  it('returns the same note when content and marks are unchanged', () => {
    const original = note({ content: 'abc', marks: [{ type: 'bold', start: 0, end: 3 }] })
    expect(updateNoteContent(original, 'abc', [{ type: 'bold', start: 0, end: 3 }])).toBe(original)
  })

  it('drops the marks property when formatting is removed', () => {
    const original = note({ content: 'abc', marks: [{ type: 'bold', start: 0, end: 3 }] })
    const updated = updateNoteContent(original, 'abc', [])
    expect(updated).not.toHaveProperty('marks')
    expect(updated.content).toBe('abc')
  })
})
