export type FormatMarkType = 'bold' | 'italic' | 'underline'

/** Marks that carry no data. A `heading` covers whole lines, typed as "# " at a line start. */
export type StyleMarkType = FormatMarkType | 'heading'

export type NoteMarkType = StyleMarkType | 'link'

/** A formatting range over `Note.content`, as UTF-16 offsets `[start, end)`. */
export interface NoteMark {
  type: NoteMarkType
  start: number
  end: number
  /** Only on `link` marks: a sanitized http(s) URL, such as the page text was clipped from. */
  href?: string
}

export interface Note {
  id: string
  title: string
  customTitle: boolean
  /** Plain text; formatting lives in `marks` so titles, search, and previews stay text-only. */
  content: string
  /** Omitted when the note has no formatting. */
  marks?: NoteMark[]
  /** Omitted when the note is not pinned. */
  pinned?: boolean
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

export type NoteFilter = 'all' | 'pinned'

export const DEFAULT_SETTINGS: KeepNotesSettings = {
  theme: 'system',
  panelPosition: null,
  panelSize: null,
  panelMinimized: false,
  selectedNoteId: null,
}
