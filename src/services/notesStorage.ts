import {
  DEFAULT_SETTINGS,
  type KeepNotesSettings,
  type Note,
  type PanelPosition,
  type PanelSize,
  type ThemeMode,
} from '../types/note'
import { isFiniteNumber, normalizeNote, sortNotes } from '../utils/noteUtils'

export const NOTE_KEY_PREFIX = 'keepnotes:note:'
export const SETTINGS_KEY = 'keepnotes:settings'

const pending = new Map<string, Note>()
const chains = new Map<string, Promise<void>>()
const tombstones = new Set<string>()
let settingsChain: Promise<void> = Promise.resolve()

function getStorage(): chrome.storage.StorageArea {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    throw new Error('Chrome storage is unavailable.')
  }
  return chrome.storage.local
}

function noteKey(id: string): string {
  return `${NOTE_KEY_PREFIX}${id}`
}

export function isNoteKey(key: string): boolean {
  return key.startsWith(NOTE_KEY_PREFIX)
}

export function noteIdFromKey(key: string): string {
  return key.slice(NOTE_KEY_PREFIX.length)
}

async function drain(id: string): Promise<void> {
  while (pending.has(id)) {
    const next = pending.get(id)
    pending.delete(id)
    if (!next || tombstones.has(id)) continue
    await getStorage().set({ [noteKey(id)]: next })
  }
}

/**
 * Writes are serialized per note and coalesced, so an older asynchronous write
 * can never land after a newer edit to the same note.
 */
export function queueNoteSave(note: Note): Promise<void> {
  if (tombstones.has(note.id)) return Promise.resolve()
  pending.set(note.id, note)
  const existing = chains.get(note.id)
  if (existing) return existing

  const chain = drain(note.id)
    .catch((error: unknown) => {
      pending.delete(note.id)
      throw error
    })
    .finally(() => {
      chains.delete(note.id)
      if (pending.has(note.id)) {
        const latest = pending.get(note.id)
        if (latest) void queueNoteSave(latest).catch(() => undefined)
      }
    })

  chains.set(note.id, chain)
  return chain
}

export async function flushNote(id: string): Promise<void> {
  for (;;) {
    const chain = chains.get(id)
    if (chain) {
      await chain
      continue
    }
    const latest = pending.get(id)
    if (latest) {
      await queueNoteSave(latest)
      continue
    }
    return
  }
}

export async function flushAllNotes(): Promise<void> {
  const ids = new Set<string>([...chains.keys(), ...pending.keys()])
  await Promise.all([...ids].map((id) => flushNote(id)))
}

export async function deleteNote(id: string): Promise<void> {
  tombstones.add(id)
  pending.delete(id)
  const chain = chains.get(id)
  if (chain) {
    await chain.catch(() => undefined)
  }
  try {
    await getStorage().remove(noteKey(id))
  } catch (error) {
    tombstones.delete(id)
    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadNote(id: string): Promise<Note | null> {
  const key = noteKey(id)
  const values = (await getStorage().get(key)) as Record<string, unknown>
  const raw = values[key]
  if (!isRecord(raw)) return null
  return normalizeNote({ ...raw, id })
}

export async function loadAllNotes(): Promise<Note[]> {
  const all = (await getStorage().get(null)) as Record<string, unknown>
  const notes: Note[] = []

  for (const [key, value] of Object.entries(all)) {
    if (!isNoteKey(key) || !isRecord(value)) continue
    const normalized = normalizeNote({ ...value, id: noteIdFromKey(key) })
    if (normalized) notes.push(normalized)
  }

  return sortNotes(notes)
}

export function normalizeSettings(raw: unknown): KeepNotesSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS }
  const record = raw as Record<string, unknown>

  const theme: ThemeMode =
    record.theme === 'light' || record.theme === 'dark' || record.theme === 'system'
      ? record.theme
      : DEFAULT_SETTINGS.theme

  let panelPosition: PanelPosition | null = null
  if (record.panelPosition && typeof record.panelPosition === 'object') {
    const position = record.panelPosition as Record<string, unknown>
    if (isFiniteNumber(position.x) && isFiniteNumber(position.y)) {
      panelPosition = { x: position.x, y: position.y }
    }
  }

  let panelSize: PanelSize | null = null
  if (record.panelSize && typeof record.panelSize === 'object') {
    const size = record.panelSize as Record<string, unknown>
    if (
      isFiniteNumber(size.width) &&
      isFiniteNumber(size.height) &&
      size.width > 0 &&
      size.height > 0
    ) {
      panelSize = { width: size.width, height: size.height }
    }
  }

  return {
    theme,
    panelPosition,
    panelSize,
    panelMinimized: record.panelMinimized === true,
    selectedNoteId: typeof record.selectedNoteId === 'string' && record.selectedNoteId ? record.selectedNoteId : null,
  }
}

export async function loadSettings(): Promise<KeepNotesSettings> {
  const values = (await getStorage().get(SETTINGS_KEY)) as Record<string, unknown>
  return normalizeSettings(values[SETTINGS_KEY])
}

export function saveSettings(settings: KeepNotesSettings): Promise<void> {
  const snapshot = normalizeSettings(settings)
  settingsChain = settingsChain
    .catch(() => undefined)
    .then(() => getStorage().set({ [SETTINGS_KEY]: snapshot }))
  return settingsChain
}

export type StorageChangeListener = (
  notes: { changed: Note[]; removedIds: string[] },
  settings: KeepNotesSettings | null
) => void

export function subscribeToStorage(listener: StorageChangeListener): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => undefined
  }
  const onChanged = chrome.storage.onChanged

  const handler = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local') return

    const changed: Note[] = []
    const removedIds: string[] = []
    let nextSettings: KeepNotesSettings | null = null

    for (const [key, change] of Object.entries(changes)) {
      if (key === SETTINGS_KEY) {
        nextSettings = normalizeSettings(change.newValue)
        continue
      }
      if (!isNoteKey(key)) continue
      const id = noteIdFromKey(key)

      if (typeof change.newValue === 'undefined') {
        if (!tombstones.has(id)) removedIds.push(id)
        continue
      }

      if (!isRecord(change.newValue)) continue
      const normalized = normalizeNote({ ...change.newValue, id })
      if (normalized) changed.push(normalized)
    }

    if (changed.length > 0 || removedIds.length > 0 || nextSettings) {
      listener({ changed, removedIds }, nextSettings)
    }
  }

  onChanged.addListener(handler)
  return () => onChanged.removeListener(handler)
}

export function __resetStorageStateForTests(): void {
  pending.clear()
  chains.clear()
  tombstones.clear()
  settingsChain = Promise.resolve()
}
