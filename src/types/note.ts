export interface Note {
  id: string
  title: string
  customTitle: boolean
  content: string
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
