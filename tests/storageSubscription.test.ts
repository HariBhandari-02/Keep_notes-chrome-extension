import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
  deleteNote,
  subscribeToStorage,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'

type ChangeHandler = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName
) => void

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-a',
    title: 'Note',
    customTitle: true,
    content: 'Content',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

function installChangeListener() {
  let handler: ChangeHandler | null = null
  const removeListener = vi.fn()

  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
      onChanged: {
        addListener: vi.fn((listener: ChangeHandler) => {
          handler = listener
        }),
        removeListener,
      },
    },
  })

  return {
    emit: (changes: Record<string, chrome.storage.StorageChange>, area = 'local') => {
      handler?.(changes, area as chrome.storage.AreaName)
    },
    removeListener,
  }
}

describe('storage subscriptions', () => {
  beforeEach(() => {
    __resetStorageStateForTests()
  })

  afterEach(() => {
    __resetStorageStateForTests()
    vi.unstubAllGlobals()
  })

  it('reports changed, removed, and settings updates', () => {
    const harness = installChangeListener()
    const listener = vi.fn()
    const unsubscribe = subscribeToStorage(listener)

    harness.emit({
      [SETTINGS_KEY]: { newValue: { theme: 'dark' } },
      [`${NOTE_KEY_PREFIX}note-a`]: { newValue: note() },
      [`${NOTE_KEY_PREFIX}gone`]: { newValue: undefined },
      [`${NOTE_KEY_PREFIX}invalid`]: { newValue: null },
      unrelated: { newValue: 'ignored' },
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const [notes, settings] = listener.mock.calls[0]
    expect(notes.changed).toHaveLength(1)
    expect(notes.changed[0].id).toBe('note-a')
    expect(notes.removedIds).toEqual(['gone'])
    expect(settings).toMatchObject({ theme: 'dark' })

    unsubscribe()
    expect(harness.removeListener).toHaveBeenCalled()
  })

  it('ignores changes outside local storage and empty updates', () => {
    const harness = installChangeListener()
    const listener = vi.fn()
    subscribeToStorage(listener)

    harness.emit({ [`${NOTE_KEY_PREFIX}note-a`]: { newValue: note() } }, 'sync')
    harness.emit({ unrelated: { newValue: true } })

    expect(listener).not.toHaveBeenCalled()
  })

  it('does not report tombstones as removals', async () => {
    const harness = installChangeListener()
    const listener = vi.fn()
    subscribeToStorage(listener)

    await deleteNote('note-a')
    harness.emit({ [`${NOTE_KEY_PREFIX}note-a`]: { newValue: undefined } })

    expect(listener).not.toHaveBeenCalled()
  })

  it('does nothing when the storage API is unavailable', () => {
    vi.stubGlobal('chrome', undefined)
    const unsubscribe = subscribeToStorage(vi.fn())
    expect(unsubscribe()).toBeUndefined()
  })
})
