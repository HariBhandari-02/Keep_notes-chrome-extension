import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteNote as deleteNoteFromStorage,
  flushAllNotes,
  loadAllNotes,
  loadSettings,
  queueNoteSave,
  saveSettings,
  subscribeToStorage,
} from '../services/notesStorage'
import {
  DEFAULT_SETTINGS,
  type KeepNotesSettings,
  type Note,
  type PanelPosition,
  type PanelSize,
  type SaveState,
  type ThemeMode,
} from '../types/note'
import {
  createBlankNote,
  sortNotes,
  updateNoteContent,
  updateNoteTitle,
} from '../utils/noteUtils'

const SAVE_DEBOUNCE_MS = 300
const CREATE_GUARD_MS = 400

function describeStorageError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/context invalidated|message port closed/i.test(message)) {
    return 'Keep Notes was reloaded or updated. Refresh this page, then reopen the panel.'
  }
  if (/quota|QUOTA_BYTES/i.test(message)) {
    return 'Chrome storage is full. Delete a note or shorten its content.'
  }
  if (/storage is unavailable/i.test(message)) {
    return 'Chrome storage is unavailable in this context.'
  }
  return 'Unable to save your note. Please try again.'
}

export interface UseNotesResult {
  ready: boolean
  loading: boolean
  loadError: string | null
  reload: () => Promise<void>
  notes: Note[]
  selectedNote: Note | null
  selectedId: string | null
  settings: KeepNotesSettings
  saveState: SaveState
  saveError: string | null
  createNote: () => string | null
  deleteNote: (id: string) => Promise<void>
  selectNote: (id: string) => void
  updateContent: (id: string, content: string) => void
  updateTitle: (id: string, title: string) => void
  setTheme: (theme: ThemeMode) => void
  setMinimized: (minimized: boolean) => void
  setPanelPosition: (position: PanelPosition) => void
  setPanelSize: (size: PanelSize) => void
  retrySave: () => Promise<void>
  flushAll: () => Promise<void>
}

export function useNotes(): UseNotesResult {
  const [notesById, setNotesById] = useState<Record<string, Note>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [settings, setSettings] = useState<KeepNotesSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)

  const notesRef = useRef<Record<string, Note>>({})
  const selectedIdRef = useRef<string | null>(null)
  const settingsRef = useRef<KeepNotesSettings>(DEFAULT_SETTINGS)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const dirty = useRef(new Set<string>())
  const editSequence = useRef(new Map<string, number>())
  const inflight = useRef(0)
  const errorRef = useRef<string | null>(null)
  const lastCreateAt = useRef(0)
  const loadRun = useRef(0)

  const replaceNotes = useCallback((next: Record<string, Note>) => {
    notesRef.current = next
    setNotesById(next)
  }, [])

  const replaceSettings = useCallback((next: KeepNotesSettings) => {
    settingsRef.current = next
    setSettings(next)
  }, [])

  const persistSettings = useCallback((next: KeepNotesSettings) => {
    void saveSettings(next).catch((error: unknown) => {
      console.warn('Keep Notes could not save settings:', error)
    })
  }, [])

  const applySettings = useCallback(
    (patch: Partial<KeepNotesSettings>) => {
      const next = { ...settingsRef.current, ...patch }
      replaceSettings(next)
      persistSettings(next)
    },
    [persistSettings, replaceSettings]
  )

  const applySelection = useCallback(
    (id: string | null) => {
      selectedIdRef.current = id
      setSelectedId(id)
      applySettings({ selectedNoteId: id })
    },
    [applySettings]
  )

  const load = useCallback(async () => {
    const run = ++loadRun.current
    setLoading(true)
    setLoadError(null)

    const [notesResult, settingsResult] = await Promise.allSettled([loadAllNotes(), loadSettings()])
    if (run !== loadRun.current) return

    let loadFailed = false
    let loadedNotes: Note[] = []
    let loadedSettings: KeepNotesSettings = { ...DEFAULT_SETTINGS }

    if (notesResult.status === 'fulfilled') {
      loadedNotes = notesResult.value
    } else {
      loadFailed = true
      console.warn('Keep Notes could not load notes:', notesResult.reason)
    }

    if (settingsResult.status === 'fulfilled') {
      loadedSettings = settingsResult.value
    } else {
      loadFailed = true
      console.warn('Keep Notes could not load settings:', settingsResult.reason)
    }

    const byId: Record<string, Note> = {}
    for (const note of loadedNotes) byId[note.id] = note

    for (const id of dirty.current) {
      const local = notesRef.current[id]
      if (local) byId[id] = local
    }

    const sorted = sortNotes(Object.values(byId))
    const storedSelected = loadedSettings.selectedNoteId
    const nextSelected =
      (storedSelected && byId[storedSelected] ? storedSelected : null) ?? sorted[0]?.id ?? null

    replaceNotes(byId)
    replaceSettings({ ...loadedSettings, selectedNoteId: nextSelected })
    selectedIdRef.current = nextSelected
    setSelectedId(nextSelected)
    setLoadError(
      loadFailed ? 'Some saved data could not be restored. Your notes may still be available.' : null
    )
    setReady(true)
    setLoading(false)
  }, [replaceNotes, replaceSettings])

  useEffect(() => {
    void load()
  }, [load])

  const persist = useCallback(async (id: string) => {
    if (!dirty.current.has(id)) return
    const note = notesRef.current[id]
    if (!note) return

    const sequence = editSequence.current.get(id) ?? 0
    inflight.current += 1
    setSaveState('saving')

    try {
      await queueNoteSave(note)
      if ((editSequence.current.get(id) ?? 0) === sequence) {
        dirty.current.delete(id)
      }
      errorRef.current = null
      setSaveError(null)
    } catch (error) {
      const friendly = describeStorageError(error)
      console.error('Keep Notes could not save:', error)
      errorRef.current = friendly
      setSaveError(friendly)
    } finally {
      inflight.current = Math.max(0, inflight.current - 1)
      if (errorRef.current) {
        setSaveState('error')
      } else if (dirty.current.size > 0 || inflight.current > 0) {
        setSaveState('saving')
      } else {
        setSaveState('saved')
      }
    }
  }, [])

  const scheduleSave = useCallback(
    (id: string) => {
      const existing = timers.current.get(id)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        timers.current.delete(id)
        void persist(id)
      }, SAVE_DEBOUNCE_MS)
      timers.current.set(id, timer)
    },
    [persist]
  )

  const mutateNote = useCallback(
    (id: string, updater: (note: Note) => Note) => {
      const current = notesRef.current[id]
      if (!current) return
      const next = updater(current)
      if (next === current) return

      const nextNotes = { ...notesRef.current, [id]: next }
      notesRef.current = nextNotes
      setNotesById(nextNotes)

      dirty.current.add(id)
      editSequence.current.set(id, (editSequence.current.get(id) ?? 0) + 1)
      errorRef.current = null
      setSaveError(null)
      setSaveState('saving')
      scheduleSave(id)
    },
    [scheduleSave]
  )

  const updateContent = useCallback(
    (id: string, content: string) => {
      mutateNote(id, (note) => updateNoteContent(note, content))
    },
    [mutateNote]
  )

  const updateTitle = useCallback(
    (id: string, title: string) => {
      mutateNote(id, (note) => updateNoteTitle(note, title))
    },
    [mutateNote]
  )

  const flushOne = useCallback(
    async (id: string) => {
      const timer = timers.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timers.current.delete(id)
      }
      await persist(id)
    },
    [persist]
  )

  const flushAll = useCallback(async () => {
    for (const [id, timer] of timers.current) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    const dirtyIds = [...dirty.current]
    await Promise.all(dirtyIds.map((id) => persist(id)))
    await flushAllNotes()
  }, [persist])

  const selectNote = useCallback(
    (id: string) => {
      if (!notesRef.current[id] || id === selectedIdRef.current) return
      const previous = selectedIdRef.current
      if (previous) void flushOne(previous)
      applySelection(id)
    },
    [applySelection, flushOne]
  )

  const createNote = useCallback(() => {
    const now = Date.now()
    if (now - lastCreateAt.current < CREATE_GUARD_MS) return null
    lastCreateAt.current = now

    const note = createBlankNote(now)
    replaceNotes({ ...notesRef.current, [note.id]: note })
    dirty.current.add(note.id)
    editSequence.current.set(note.id, 1)
    errorRef.current = null
    setSaveError(null)
    setSaveState('saving')
    void persist(note.id)
    applySelection(note.id)
    return note.id
  }, [applySelection, persist, replaceNotes])

  const deleteNote = useCallback(
    async (id: string) => {
      const timer = timers.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timers.current.delete(id)
      }
      const wasDirty = dirty.current.has(id)
      dirty.current.delete(id)

      try {
        await deleteNoteFromStorage(id)
        const nextNotes = { ...notesRef.current }
        delete nextNotes[id]
        replaceNotes(nextNotes)

        if (selectedIdRef.current === id) {
          const fallback = sortNotes(Object.values(nextNotes))[0]?.id ?? null
          applySelection(fallback)
        }
      } catch (error) {
        if (wasDirty) {
          dirty.current.add(id)
          scheduleSave(id)
        }
        const friendly = describeStorageError(error)
        errorRef.current = friendly
        setSaveError(friendly)
        setSaveState('error')
      }
    },
    [applySelection, replaceNotes, scheduleSave]
  )

  const setTheme = useCallback((theme: ThemeMode) => applySettings({ theme }), [applySettings])

  const setMinimized = useCallback(
    (minimized: boolean) => {
      if (settingsRef.current.panelMinimized === minimized) return
      applySettings({ panelMinimized: minimized })
    },
    [applySettings]
  )

  const setPanelPosition = useCallback(
    (position: PanelPosition) => {
      const current = settingsRef.current.panelPosition
      if (current && current.x === position.x && current.y === position.y) return
      applySettings({ panelPosition: position })
    },
    [applySettings]
  )

  const setPanelSize = useCallback(
    (size: PanelSize) => {
      const current = settingsRef.current.panelSize
      if (current && current.width === size.width && current.height === size.height) return
      applySettings({ panelSize: size })
    },
    [applySettings]
  )

  const retrySave = useCallback(async () => {
    errorRef.current = null
    setSaveError(null)
    setSaveState('saving')
    await flushAll()
    if (!errorRef.current && dirty.current.size === 0) setSaveState('saved')
  }, [flushAll])

  useEffect(() => {
    if (!ready) return

    return subscribeToStorage(({ changed, removedIds }, nextSettings) => {
      if (nextSettings && nextSettings.theme !== settingsRef.current.theme) {
        const next = { ...settingsRef.current, theme: nextSettings.theme }
        settingsRef.current = next
        setSettings(next)
      }

      if (changed.length === 0 && removedIds.length === 0) return

      let nextNotes = notesRef.current
      let notesChanged = false
      let removedSelected = false

      for (const id of removedIds) {
        if (!nextNotes[id]) continue
        if (dirty.current.has(id)) continue
        if (nextNotes === notesRef.current) nextNotes = { ...notesRef.current }
        delete nextNotes[id]
        notesChanged = true
        if (selectedIdRef.current === id) removedSelected = true
      }

      for (const incoming of changed) {
        if (dirty.current.has(incoming.id)) continue
        const current = nextNotes[incoming.id]
        if (current && incoming.updatedAt <= current.updatedAt) continue
        if (nextNotes === notesRef.current) nextNotes = { ...notesRef.current }
        nextNotes[incoming.id] = incoming
        notesChanged = true
      }

      if (!notesChanged) return
      replaceNotes(nextNotes)

      if (removedSelected || (selectedIdRef.current && !nextNotes[selectedIdRef.current])) {
        const fallback = sortNotes(Object.values(nextNotes))[0]?.id ?? null
        applySelection(fallback)
      }
    })
  }, [applySelection, ready, replaceNotes])

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
    }
  }, [])

  const notes = useMemo(() => sortNotes(Object.values(notesById)), [notesById])
  const selectedNote = selectedId ? notesById[selectedId] ?? null : null

  return {
    ready,
    loading,
    loadError,
    reload: load,
    notes,
    selectedNote,
    selectedId,
    settings,
    saveState,
    saveError,
    createNote,
    deleteNote,
    selectNote,
    updateContent,
    updateTitle,
    setTheme,
    setMinimized,
    setPanelPosition,
    setPanelSize,
    retrySave,
    flushAll,
  }
}
