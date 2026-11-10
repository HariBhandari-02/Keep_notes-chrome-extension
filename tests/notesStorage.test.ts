import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
  deleteNote,
  flushAllNotes,
  loadAllNotes,
  loadNote,
  loadSettings,
  normalizeSettings,
  queueNoteSave,
  saveSettings,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
} from '../src/utils/noteLimits'
import { installFakeChrome } from './helpers/fakeChrome'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-a',
    title: 'First note',
    customTitle: true,
    content: 'Hello world',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('notes storage', () => {
  beforeEach(() => {
    __resetStorageStateForTests()
    vi.useRealTimers()
  })

  afterEach(() => {
    __resetStorageStateForTests()
    vi.unstubAllGlobals()
  })

  it('persists a note and restores it later', async () => {
    const fake = installFakeChrome()
    const note = makeNote()

    await queueNoteSave(note)
    await flushAllNotes()

    expect(fake.data[`${NOTE_KEY_PREFIX}${note.id}`]).toEqual(note)

    const restored = await loadAllNotes()
    expect(restored).toHaveLength(1)
    expect(restored[0]).toEqual(note)
  })

  it('keeps multiple notes independent and deleting one leaves the others', async () => {
    const fake = installFakeChrome()
    const first = makeNote({ id: 'one', content: 'first content', updatedAt: 1 })
    const second = makeNote({ id: 'two', content: 'second content', updatedAt: 2 })

    await Promise.all([queueNoteSave(first), queueNoteSave(second)])
    await flushAllNotes()

    await deleteNote('one')
    expect(fake.data[`${NOTE_KEY_PREFIX}one`]).toBeUndefined()
    expect(fake.data[`${NOTE_KEY_PREFIX}two`]).toEqual(second)

    const remaining = await loadAllNotes()
    expect(remaining.map((note) => note.id)).toEqual(['two'])
  })

  it('coalesces rapid edits so the newest content wins', async () => {
    const fake = installFakeChrome({ writeDelayMs: 15 })
    const base = makeNote({ id: 'rapid', content: 'v1', updatedAt: 1 })

    queueNoteSave(base)
    queueNoteSave({ ...base, content: 'v2', updatedAt: 2 })
    queueNoteSave({ ...base, content: 'v3', updatedAt: 3 })

    await flushAllNotes()

    expect((fake.data[`${NOTE_KEY_PREFIX}rapid`] as Note).content).toBe('v3')
    expect(fake.set.mock.calls.length).toBeLessThan(4)
    expect((await loadAllNotes())[0].content).toBe('v3')
  })

  it('ignores malformed notes in storage', async () => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}broken`] = { nope: true }
    fake.data[`${NOTE_KEY_PREFIX}nullish`] = null
    fake.data[`${NOTE_KEY_PREFIX}valid`] = makeNote({ id: 'valid' })
    fake.data['unrelated-key'] = 'ignored'

    const notes = await loadAllNotes()
    expect(notes.map((note) => note.id)).toEqual(['valid'])
  })

  it('ignores storage keys with unsafe or prototype-polluting ids', async () => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}__proto__`] = makeNote({ id: '__proto__' })
    fake.data[`${NOTE_KEY_PREFIX}constructor`] = makeNote({ id: 'constructor' })
    fake.data[`${NOTE_KEY_PREFIX}${'a'.repeat(129)}`] = makeNote({ id: 'a'.repeat(129) })
    fake.data[`${NOTE_KEY_PREFIX}safe-id`] = makeNote({ id: 'safe-id' })

    const notes = await loadAllNotes()
    expect(notes.map((note) => note.id)).toEqual(['safe-id'])
    expect(Object.prototype).not.toHaveProperty('polluted')
  })

  it('clamps oversized stored records before exposing them', async () => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}huge`] = makeNote({
      id: 'huge',
      title: 't'.repeat(MAX_NOTE_TITLE_LENGTH + 20),
      content: 'c'.repeat(MAX_NOTE_CONTENT_LENGTH + 20),
      customTitle: true,
    })

    const [stored] = await loadAllNotes()
    expect(stored.title).toHaveLength(MAX_NOTE_TITLE_LENGTH)
    expect(stored.content).toHaveLength(MAX_NOTE_CONTENT_LENGTH)
  })

  it('rejects invalid note ids before reading or writing', async () => {
    const fake = installFakeChrome()

    expect(await loadNote('__proto__')).toBeNull()
    expect(fake.get).not.toHaveBeenCalled()

    await deleteNote('constructor')
    expect(fake.remove).not.toHaveBeenCalled()

    await expect(queueNoteSave(makeNote({ id: '__proto__' }))).rejects.toThrow('Invalid note data')
    expect(fake.set).not.toHaveBeenCalled()
  })

  it('normalizes malformed timestamps when loading', async () => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}times`] = {
      ...makeNote({ id: 'times' }),
      createdAt: Number.NaN,
      updatedAt: Number.POSITIVE_INFINITY,
    }

    const [stored] = await loadAllNotes()
    expect(Number.isSafeInteger(stored.createdAt)).toBe(true)
    expect(Number.isSafeInteger(stored.updatedAt)).toBe(true)
  })

  it('recovers a note after a transient write failure', async () => {
    const fake = installFakeChrome()
    fake.set.mockRejectedValueOnce(new Error('temporary failure'))

    await expect(queueNoteSave(makeNote({ id: 'retry' }))).rejects.toThrow('temporary failure')
    await queueNoteSave(makeNote({ id: 'retry', content: 'second attempt' }))
    await flushAllNotes()

    expect((fake.data[`${NOTE_KEY_PREFIX}retry`] as Note).content).toBe('second attempt')
  })

  it('normalizes invalid settings and persists valid ones', async () => {
    const fake = installFakeChrome()
    fake.data[SETTINGS_KEY] = {
      theme: 'neon',
      panelPosition: { x: Number.NaN, y: 10 },
      panelSize: { width: Number.NaN, height: -10 },
      panelMinimized: 'yes',
      selectedNoteId: 42,
    }

    const fallback = await loadSettings()
    expect(fallback).toEqual({
      theme: 'system',
      panelPosition: null,
      panelSize: null,
      panelMinimized: false,
      selectedNoteId: null,
    })

    await saveSettings({
      theme: 'dark',
      panelPosition: { x: 20, y: 30 },
      panelSize: { width: 520, height: 620 },
      panelMinimized: true,
      selectedNoteId: 'note-a',
    })

    const restored = await loadSettings()
    expect(restored).toEqual({
      theme: 'dark',
      panelPosition: { x: 20, y: 30 },
      panelSize: { width: 520, height: 620 },
      panelMinimized: true,
      selectedNoteId: 'note-a',
    })
  })

  it('normalizes partial settings safely', () => {
    expect(normalizeSettings({ theme: 'light' })).toMatchObject({
      theme: 'light',
      panelPosition: null,
      panelSize: null,
      panelMinimized: false,
      selectedNoteId: null,
    })
  })

  it('rejects unsafe settings values and selected note ids', () => {
    const settings = normalizeSettings({
      panelPosition: { x: Number.POSITIVE_INFINITY, y: 1e300 },
      panelSize: { width: 1e300, height: -1 },
      selectedNoteId: '__proto__',
    })

    expect(settings.panelPosition).toBeNull()
    expect(settings.panelSize).toBeNull()
    expect(settings.selectedNoteId).toBeNull()
  })

  it('reports storage write failures', async () => {
    installFakeChrome({ failWrites: true })
    await expect(queueNoteSave(makeNote())).rejects.toThrow('storage write failed')
  })

  it('loads a single note and tolerates missing records', async () => {
    const fake = installFakeChrome()
    fake.data[`${NOTE_KEY_PREFIX}one`] = makeNote({ id: 'one' })

    expect((await loadNote('one'))?.id).toBe('one')
    expect(await loadNote('missing')).toBeNull()
  })

  it('skips saving notes that were deleted', async () => {
    const fake = installFakeChrome()

    await deleteNote('gone')
    await queueNoteSave(makeNote({ id: 'gone' }))
    await flushAllNotes()

    expect(fake.data[`${NOTE_KEY_PREFIX}gone`]).toBeUndefined()
  })

  it('reports delete failures', async () => {
    const fake = installFakeChrome()
    fake.remove.mockRejectedValueOnce(new Error('remove failed'))

    await expect(deleteNote('x')).rejects.toThrow('remove failed')

    await queueNoteSave(makeNote({ id: 'x' }))
    await flushAllNotes()
    expect(fake.data[`${NOTE_KEY_PREFIX}x`]).toBeDefined()
  })

  it('rejects storage access when chrome is unavailable', async () => {
    vi.stubGlobal('chrome', undefined)
    await expect(loadAllNotes()).rejects.toThrow('Chrome storage is unavailable')
  })

  it('stores each note under its own key', async () => {
    const fake = installFakeChrome()
    await queueNoteSave(makeNote({ id: 'alpha' }))
    await queueNoteSave(makeNote({ id: 'beta' }))
    await flushAllNotes()

    const noteKeys = Object.keys(fake.data).filter((key) => key.startsWith(NOTE_KEY_PREFIX))
    expect(noteKeys.sort()).toEqual([`${NOTE_KEY_PREFIX}alpha`, `${NOTE_KEY_PREFIX}beta`])
  })
})
