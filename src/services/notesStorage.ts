import {
  DEFAULT_SETTINGS,
  type KeepNotesSettings,
  type Note,
  type PanelPosition,
  type PanelSize,
  type ThemeMode,
} from '../types/note'
import {
  isSafeCoordinate,
  isSafeDimension,
  isValidNoteId,
} from '../utils/noteLimits'
import { normalizeNote, sortNotes } from '../utils/noteUtils'

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
  const normalized = normalizeNote(note)
  if (!normalized) return Promise.reject(new Error('Invalid note data.'))
  if (tombstones.has(normalized.id)) return Promise.resolve()
  pending.set(normalized.id, normalized)
  const existing = chains.get(normalized.id)
  if (existing) return existing

  const id = normalized.id
  const chain = drain(id)
    .catch((error: unknown) => {
      pending.delete(id)
      throw error
    })
    .finally(() => {
      chains.delete(id)
      if (pending.has(id)) {
        const latest = pending.get(id)
        if (latest) void queueNoteSave(latest).catch(() => undefined)
      }
    })

  chains.set(id, chain)
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
  if (!isValidNoteId(id)) return
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
  if (!isValidNoteId(id)) return null
  const key = noteKey(id)
  const values = await getStorage().get(key)
  const raw = values[key]
  if (!isRecord(raw)) return null
  return normalizeNote({ ...raw, id })
}

export async function loadAllNotes(): Promise<Note[]> {
  const all = await getStorage().get(null)
  if (!isRecord(all)) return []
  const notes: Note[] = []

  for (const [key, value] of Object.entries(all)) {
    if (!isNoteKey(key) || !isRecord(value)) continue
    const id = noteIdFromKey(key)
    if (!isValidNoteId(id)) continue
    const normalized = normalizeNote({ ...value, id })
    if (normalized) notes.push(normalized)
  }

  return sortNotes(notes)
}

export function normalizeSettings(raw: unknown): KeepNotesSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS }

  const theme: ThemeMode =
    raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system'
      ? raw.theme
      : DEFAULT_SETTINGS.theme

  let panelPosition: PanelPosition | null = null
  if (isRecord(raw.panelPosition)) {
    const position = raw.panelPosition
    if (isSafeCoordinate(position.x) && isSafeCoordinate(position.y)) {
      panelPosition = { x: position.x, y: position.y }
    }
  }

  let panelSize: PanelSize | null = null
  if (isRecord(raw.panelSize)) {
    const size = raw.panelSize
    if (isSafeDimension(size.width) && isSafeDimension(size.height)) {
      panelSize = { width: size.width, height: size.height }
    }
  }

  return {
    theme,
    panelPosition,
    panelSize,
    panelMinimized: raw.panelMinimized === true,
    selectedNoteId: isValidNoteId(raw.selectedNoteId) ? raw.selectedNoteId : null,
  }
}

export async function loadSettings(): Promise<KeepNotesSettings> {
  const values = await getStorage().get(SETTINGS_KEY)
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

interface CollectedStorageChanges {
  changed: Note[]
  removedIds: string[]
  nextSettings: KeepNotesSettings | null
}

function collectNoteChange(
  key: string,
  change: chrome.storage.StorageChange,
  changed: Note[],
  removedIds: string[]
): void {
  const id = noteIdFromKey(key)
  if (!isValidNoteId(id)) return

  if (change.newValue === undefined) {
    if (!tombstones.has(id)) removedIds.push(id)
    return
  }

  if (!isRecord(change.newValue)) return
  const normalized = normalizeNote({ ...change.newValue, id })
  if (normalized) changed.push(normalized)
}

function collectStorageChanges(changes: unknown): CollectedStorageChanges {
  const changed: Note[] = []
  const removedIds: string[] = []
  let nextSettings: KeepNotesSettings | null = null

  if (!isRecord(changes)) {
    return { changed, removedIds, nextSettings }
  }

  for (const [key, value] of Object.entries(changes)) {
    if (!isRecord(value)) continue
    const change = value as chrome.storage.StorageChange

    if (key === SETTINGS_KEY) {
      nextSettings = normalizeSettings(change.newValue)
      continue
    }
    if (!isNoteKey(key)) continue
    collectNoteChange(key, change, changed, removedIds)
  }

  return { changed, removedIds, nextSettings }
}

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

    const { changed, removedIds, nextSettings } = collectStorageChanges(changes)
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
