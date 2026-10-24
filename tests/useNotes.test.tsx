// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotes } from '../src/hooks/useNotes'
import {
  NOTE_KEY_PREFIX,
  SETTINGS_KEY,
  __resetStorageStateForTests,
} from '../src/services/notesStorage'
import type { Note } from '../src/types/note'
import { installFakeChrome } from './helpers/fakeChrome'

type ChangeHandler = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName
) => void

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-a',
    title: 'Note A',
    customTitle: true,
    content: 'Content A',
    createdAt: 1,
    updatedAt: 10,
    ...overrides,
  }
}

function storedNotes(data: Record<string, unknown>): Note[] {
  return Object.entries(data)
    .filter(([key]) => key.startsWith(NOTE_KEY_PREFIX))
    .map(([, value]) => value as Note)
}

function setup(prepare?: (fake: ReturnType<typeof installFakeChrome>) => void) {
  __resetStorageStateForTests()
  const fake = installFakeChrome()
  prepare?.(fake)
  const handlers: ChangeHandler[] = []
  const chromeStub = globalThis.chrome as unknown as {
    storage: { onChanged: { addListener: unknown; removeListener: unknown } }
  }
  chromeStub.storage.onChanged = {
    addListener: vi.fn((handler: ChangeHandler) => {
      handlers.push(handler)
    }),
    removeListener: vi.fn(),
  }

  const emit = (changes: Record<string, chrome.storage.StorageChange>, area = 'local') => {
    for (const handler of handlers) handler(changes, area as chrome.storage.AreaName)
  }

  const view = renderHook(() => useNotes())
  return { ...view, fake, emit }
}

describe('useNotes', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    __resetStorageStateForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('applies storage changes and keeps local edits', async () => {
    const first = makeNote({ id: 'first', updatedAt: 10 })
    const second = makeNote({ id: 'second', updatedAt: 20 })
    const { result, emit } = setup((fake) => {
      fake.data[`${NOTE_KEY_PREFIX}first`] = first
      fake.data[`${NOTE_KEY_PREFIX}second`] = second
      fake.data[SETTINGS_KEY] = { theme: 'light', selectedNoteId: 'first' }
    })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.notes.map((note) => note.id)).toEqual(['second', 'first'])

    act(() => {
      emit({ [SETTINGS_KEY]: { newValue: { theme: 'dark' } } })
    })
    expect(result.current.settings.theme).toBe('dark')

    act(() => {
      emit({
        [`${NOTE_KEY_PREFIX}second`]: {
          newValue: { ...second, content: 'Remote update', updatedAt: 30 },
        },
      })
    })
    expect(result.current.notes.find((note) => note.id === 'second')?.content).toBe(
      'Remote update'
    )

    act(() => {
      emit({
        [`${NOTE_KEY_PREFIX}second`]: {
          newValue: { ...second, content: 'Stale update', updatedAt: 5 },
        },
      })
    })
    expect(result.current.notes.find((note) => note.id === 'second')?.content).toBe(
      'Remote update'
    )

    act(() => {
      result.current.updateContent('first', 'Local edit')
    })
    act(() => {
      emit({
        [`${NOTE_KEY_PREFIX}first`]: {
          newValue: { ...first, content: 'Remote edit', updatedAt: 40 },
        },
      })
    })
    expect(result.current.notes.find((note) => note.id === 'first')?.content).toBe('Local edit')

    await act(async () => {
      await result.current.flushAll()
    })

    act(() => {
      emit({ [`${NOTE_KEY_PREFIX}first`]: { newValue: undefined } })
    })
    await waitFor(() =>
      expect(result.current.notes.find((note) => note.id === 'first')).toBeUndefined()
    )
    expect(result.current.selectedId).toBe('second')
  })

  it('reports load failures and reloads successfully', async () => {
    const { result, fake } = setup((chrome) => {
      chrome.get.mockRejectedValue(new Error('read failed'))
    })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.loadError).toContain('Some saved data could not be restored')

    fake.get.mockResolvedValue({})
    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.loadError).toBeNull()
    expect(result.current.notes).toEqual([])
  })

  it.each([
    ['context invalidated', 'reloaded or updated'],
    ['QUOTA_BYTES exceeded', 'storage is full'],
    ['storage is unavailable', 'unavailable in this context'],
    ['unexpected failure', 'Unable to save'],
  ])('describes save errors for %s', async (message, expected) => {
    const { result, fake } = setup()
    fake.set.mockRejectedValue(new Error(message))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => {
      result.current.createNote()
    })

    await waitFor(() => expect(result.current.saveError).toContain(expected))
    expect(result.current.saveState).toBe('error')
  })

  it('guards rapid creation and flushes pending notes', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.ready).toBe(true))

    let firstId: string | null = null
    act(() => {
      firstId = result.current.createNote()
      expect(result.current.createNote()).toBeNull()
    })
    expect(firstId).not.toBeNull()

    await new Promise((resolve) => setTimeout(resolve, 420))

    act(() => {
      result.current.createNote()
    })
    expect(result.current.notes).toHaveLength(2)

    act(() => {
      result.current.updateContent(firstId as string, 'Pending edit')
      result.current.selectNote(result.current.notes[1].id)
    })

    await act(async () => {
      await result.current.flushAll()
      await result.current.retrySave()
    })
    expect(result.current.saveState).toBe('saved')
  })

  it('ignores redundant and unsafe settings updates', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => {
      result.current.setMinimized(false)
      result.current.setPanelPosition({ x: 10, y: 20 })
      result.current.setPanelPosition({ x: 10, y: 20 })
      result.current.setPanelPosition({ x: Number.NaN, y: 1e300 })
      result.current.setPanelSize({ width: 400, height: 500 })
      result.current.setPanelSize({ width: 400, height: 500 })
      result.current.setPanelSize({ width: 0, height: 1e300 })
    })

    expect(result.current.settings.panelPosition).toEqual({ x: 10, y: 20 })
    expect(result.current.settings.panelSize).toEqual({ width: 400, height: 500 })
  })

  it('ignores invalid note ids and keeps the selected note safe', async () => {
    const { result } = setup((fake) => {
      fake.data[`${NOTE_KEY_PREFIX}safe`] = makeNote({ id: 'safe' })
      fake.data[`${NOTE_KEY_PREFIX}__proto__`] = makeNote({ id: '__proto__' })
      fake.data[SETTINGS_KEY] = { selectedNoteId: '__proto__' }
    })

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.notes.map((note) => note.id)).toEqual(['safe'])
    expect(result.current.selectedId).toBe('safe')

    act(() => {
      result.current.selectNote('__proto__')
    })
    expect(result.current.selectedId).toBe('safe')
  })

  it('recovers the latest edit after a storage failure', async () => {
    const { result, fake } = setup()
    await waitFor(() => expect(result.current.ready).toBe(true))

    fake.set.mockRejectedValueOnce(new Error('quota exceeded'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let id: string | null = null
    act(() => {
      id = result.current.createNote()
    })
    await waitFor(() => expect(result.current.saveState).toBe('error'))

    act(() => {
      result.current.updateContent(id as string, 'Latest edit survives')
    })
    await act(async () => {
      await result.current.retrySave()
    })

    expect((storedNotes(fake.data)[0] as Note).content).toBe('Latest edit survives')
    expect(result.current.saveState).toBe('saved')
  })

  it('selects a fallback note after deleting the selected one', async () => {
    const { result } = setup((fake) => {
      fake.data[`${NOTE_KEY_PREFIX}first`] = makeNote({ id: 'first', updatedAt: 10 })
      fake.data[`${NOTE_KEY_PREFIX}second`] = makeNote({ id: 'second', updatedAt: 20 })
      fake.data[SETTINGS_KEY] = { selectedNoteId: 'first' }
    })

    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.deleteNote('first')
    })

    expect(result.current.selectedId).toBe('second')
  })

  it('reports delete failures and keeps dirty notes queued', async () => {
    const { result, fake } = setup()
    await waitFor(() => expect(result.current.ready).toBe(true))

    let id: string | null = null
    act(() => {
      id = result.current.createNote()
    })
    fake.remove.mockRejectedValueOnce(new Error('remove failed'))

    await act(async () => {
      await result.current.deleteNote(id as string)
    })

    expect(result.current.saveError).toContain('Unable to save')
    expect(result.current.saveState).toBe('error')
  })
})
