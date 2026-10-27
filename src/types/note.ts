export type NoteMarkType = 'bold' | 'italic' | 'underline'

/** A formatting range over `Note.content`, as UTF-16 offsets `[start, end)`. */
export interface NoteMark {
  type: NoteMarkType
  start: number
  end: number
}

export interface Note {
  id: string
  title: string
  customTitle: boolean
  /** Plain text; formatting lives in `marks` so titles, search, and previews stay text-only. */
  content: string
  /** Omitted when the note has no formatting. */
  marks?: NoteMark[]
  createdAt: number
  updatedAt: number
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface PanelPosition {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export interface KeepNotesSettings {
  theme: ThemeMode
  panelPosition: PanelPosition | null
  panelSize: PanelSize | null
  panelMinimized: boolean
  selectedNoteId: string | null
}

export type SaveState = 'saved' | 'saving' | 'error'

export type PanelView = 'editor' | 'list'

export const DEFAULT_SETTINGS: KeepNotesSettings = {
  theme: 'system',
  panelPosition: null,
  panelSize: null,
  panelMinimized: false,
  selectedNoteId: null,
}
