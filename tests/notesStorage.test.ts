import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
  deleteNote,
  flushAllNotes,
  loadAllNotes,
  loadSettings,
  normalizeSettings,
  queueNoteSave,
  saveSettings,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'
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

  it('reports storage write failures', async () => {
    installFakeChrome({ failWrites: true })
    await expect(queueNoteSave(makeNote())).rejects.toThrow('storage write failed')
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
