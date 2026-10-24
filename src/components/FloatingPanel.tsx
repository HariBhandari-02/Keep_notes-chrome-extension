import { AlertTriangle, FilePlus2, NotebookPen } from 'lucide-react'
import {
  Resizable,
  type Enable,
  type HandleClassName,
  type HandleStyles,
  type ResizeCallback,
  type ResizeStartCallback,
} from 're-resizable'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { PanelState } from '../content/panelBus'
import { useDraggable } from '../hooks/useDraggable'
import type { UseNotesResult } from '../hooks/useNotes'
import type { PanelPosition, PanelSize, PanelView } from '../types/note'
import { cx } from '../utils/cx'
import { filterNotes } from '../utils/noteUtils'
import {
  clampPosition,
  defaultPanelPosition,
  getPanelSize,
  getResizeLimits,
  resizePanelPosition,
  type ResizeLimits,
} from '../utils/position'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { PanelHeader } from './PanelHeader'
import { SaveStatus } from './SaveStatus'
import { ThemeToggle } from './ThemeToggle'

interface FloatingPanelProps {
  store: UseNotesResult
  panelState: PanelState
  getPageSelection: () => string
  onClose: () => void
}

interface ToastState {
  key: number
  text: string
}

const RESIZE_ENABLE: Enable = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
}

const RESIZE_HANDLE_CLASSES: HandleClassName = {
  top: 'keep-notes-resize-handle keep-notes-resize-top',
  right: 'keep-notes-resize-handle keep-notes-resize-right',
  bottom: 'keep-notes-resize-handle keep-notes-resize-bottom',
  left: 'keep-notes-resize-handle keep-notes-resize-left',
  topRight: 'keep-notes-resize-handle keep-notes-resize-top-right',
  bottomRight:
    'keep-notes-resize-handle keep-notes-resize-bottom-right keep-notes-resize-grip text-neutral-400 dark:text-neutral-500',
  bottomLeft: 'keep-notes-resize-handle keep-notes-resize-bottom-left',
  topLeft: 'keep-notes-resize-handle keep-notes-resize-top-left',
}

const RESIZE_HANDLE_STYLES: HandleStyles = {
  top: { top: 0, left: 14, right: 14, width: 'auto', height: 8 },
  right: { right: 0, top: 14, bottom: 14, left: undefined, width: 8, height: 'auto' },
  bottom: { bottom: 0, left: 14, right: 14, top: undefined, width: 'auto', height: 8 },
  left: { left: 0, top: 14, bottom: 14, width: 8, height: 'auto' },
  topLeft: { top: 0, left: 0, width: 18, height: 18 },
  topRight: { top: 0, right: 0, width: 18, height: 18 },
  bottomLeft: { bottom: 0, left: 0, width: 18, height: 18 },
  bottomRight: { bottom: 0, right: 0, width: 18, height: 18 },
}

const PANEL_ACCESSIBILITY_PROPS: Record<string, unknown> = {
  role: 'dialog',
  'aria-modal': 'false',
  'aria-label': 'Keep Notes',
  tabIndex: -1,
  'data-keep-notes-panel': '',
}

function EmptyState({
  hasNotes,
  onCreate,
  onBrowse,
}: Readonly<{
  hasNotes: boolean
  onCreate: () => void
  onBrowse: () => void
}>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300">
        <NotebookPen size={22} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h2 className="mt-3 text-[14px] font-semibold tracking-[-0.01em] text-neutral-800 dark:text-neutral-100">
        {hasNotes ? 'No note selected' : 'A quiet place for your thoughts'}
      </h2>
      <p className="mt-1 max-w-[230px] text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        {hasNotes
          ? 'Pick a note from your list or start a fresh one.'
          : 'Capture an idea while you read. Everything stays on this device.'}
      </p>
      <button
        type="button"
        onClick={hasNotes ? onBrowse : onCreate}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-medium text-white outline-none transition-colors hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-neutral-900"
      >
        <FilePlus2 size={13} strokeWidth={2.2} aria-hidden="true" />
        {hasNotes ? 'Browse notes' : 'Create your first note'}
      </button>
    </div>
  )
}

function usePanelKeydown({
  panelRef,
  confirmDeleteId,
  handleClose,
  handleCreate,
  handleCancelDelete,
}: Readonly<{
  panelRef: RefObject<HTMLElement | null>
  confirmDeleteId: string | null
  handleClose: () => void
  handleCreate: () => void
  handleCancelDelete: () => void
}>) {
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const handlePanelKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        handleCreate()
        return
      }

      if (event.key !== 'Escape') return

      if (confirmDeleteId) {
        event.preventDefault()
        handleCancelDelete()
        return
      }

      const origin = event.target
      if (
        origin instanceof HTMLElement &&
        (origin.tagName === 'INPUT' ||
          origin.tagName === 'TEXTAREA' ||
          origin.isContentEditable)
      ) {
        event.preventDefault()
        origin.blur()
        panel.focus({ preventScroll: true })
        return
      }

      event.preventDefault()
      handleClose()
    }

    panel.addEventListener('keydown', handlePanelKeyDown)
    return () => panel.removeEventListener('keydown', handlePanelKeyDown)
  }, [confirmDeleteId, handleCancelDelete, handleClose, handleCreate, panelRef])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const panel = panelRef.current
      if (!panel || event.composedPath().includes(panel)) return

      const active = document.activeElement
      if (active === document.body || active === null) {
        event.preventDefault()
        handleClose()
      }
    }

    globalThis.addEventListener('keydown', handleWindowKeyDown)
    return () => globalThis.removeEventListener('keydown', handleWindowKeyDown)
  }, [handleClose, panelRef])
}

export function FloatingPanel({
  store,
  panelState,
  getPageSelection,
  onClose,
}: Readonly<FloatingPanelProps>) {
  const {
    notes,
    selectedNote,
    selectedId,
    settings,
    saveState,
    saveError,
    loadError,
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
    reload,
  } = store

  const [view, setView] = useState<PanelView>('editor')
  const [query, setQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editorFocusSignal, setEditorFocusSignal] = useState(0)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [preferredSize, setPreferredSize] = useState<PanelSize | null>(settings.panelSize)
  const [viewport, setViewport] = useState(() => ({
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
  }))

  const panelRef = useRef<HTMLElement | null>(null)
  const resizableRef = useRef<Resizable | null>(null)
  const resizeStartRef = useRef<{ position: PanelPosition; size: PanelSize } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const panelSize = useMemo(
    () => getPanelSize(viewport.width, viewport.height, preferredSize),
    [preferredSize, viewport.width, viewport.height]
  )

  const [initialPosition] = useState<PanelPosition>(() => {
    const saved = settings.panelPosition
    if (saved) {
      return clampPosition(
        saved,
        panelSize.width,
        panelSize.height,
        globalThis.innerWidth,
        globalThis.innerHeight
      )
    }
    return defaultPanelPosition(
      globalThis.innerWidth,
      globalThis.innerHeight,
      panelSize.width,
      panelSize.height
    )
  })

  const {
    position,
    isDragging,
    reclamp,
    getPosition,
    moveTo,
    commitPosition,
    headerDragProps,
  } = useDraggable({
    panelRef,
    initialPosition,
    onDragEnd: setPanelPosition,
  })

  const restLimits = useMemo(
    () => getResizeLimits('bottomRight', position, panelSize, viewport.width, viewport.height),
    [panelSize, position, viewport.height, viewport.width]
  )
  const [lockedLimits, setLockedLimits] = useState<ResizeLimits | null>(null)
  const resizeLimits = isResizing && lockedLimits ? lockedLimits : restLimits

  useLayoutEffect(() => {
    panelRef.current = resizableRef.current?.resizable ?? null
  }, [])

  const filteredNotes = useMemo(() => filterNotes(notes, query), [notes, query])
  const minimized = settings.panelMinimized

  const showToast = useCallback((text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ key: Date.now(), text })
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    if (view === 'list' && saveError) showToast(saveError)
  }, [saveError, showToast, view])

  useEffect(() => {
    const handleResize = () =>
      setViewport({ width: globalThis.innerWidth, height: globalThis.innerHeight })
    globalThis.addEventListener('resize', handleResize)
    return () => globalThis.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isResizing) reclamp()
  }, [isResizing, minimized, view, viewport.height, viewport.width, reclamp])

  const handleResizeStart = useCallback<ResizeStartCallback>(
    (event, direction, element) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const startPosition = getPosition()
      const startSize = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }

      resizeStartRef.current = { position: startPosition, size: startSize }
      setLockedLimits(
        getResizeLimits(
          direction,
          startPosition,
          startSize,
          globalThis.innerWidth,
          globalThis.innerHeight
        )
      )
      setIsResizing(true)
    },
    [getPosition]
  )

  const handleResize = useCallback<ResizeCallback>(
    (_event, direction, _element, delta) => {
      const start = resizeStartRef.current
      if (!start) return

      const nextSize = {
        width: Math.max(1, Math.round(start.size.width + delta.width)),
        height: Math.max(1, Math.round(start.size.height + delta.height)),
      }
      setPreferredSize(nextSize)

      const nextPosition = resizePanelPosition(direction, start.position, start.size, nextSize)
      if (nextPosition.x !== start.position.x || nextPosition.y !== start.position.y) {
        moveTo(nextPosition)
      }
    },
    [moveTo]
  )

  const handleResizeStop = useCallback<ResizeCallback>(
    (_event, direction, _element, delta) => {
      const start = resizeStartRef.current
      resizeStartRef.current = null
      setIsResizing(false)
      if (!start) return

      const finalSize = {
        width: Math.max(1, Math.round(start.size.width + delta.width)),
        height: Math.max(1, Math.round(start.size.height + delta.height)),
      }
      setPreferredSize(finalSize)
      setPanelSize(finalSize)
      moveTo(resizePanelPosition(direction, start.position, start.size, finalSize))
      commitPosition()
    },
    [commitPosition, moveTo, setPanelSize]
  )

  const handleCreate = useCallback(() => {
    if (settings.panelMinimized) setMinimized(false)
    const id = createNote()
    if (!id) return
    setView('editor')
    setQuery('')
    setConfirmDeleteId(null)
    setEditorFocusSignal((value) => value + 1)
  }, [createNote, setMinimized, settings.panelMinimized])

  const handleSelect = useCallback(
    (id: string) => {
      selectNote(id)
      setView('editor')
      setQuery('')
      setConfirmDeleteId(null)
      setEditorFocusSignal((value) => value + 1)
    },
    [selectNote]
  )

  const handleToggleView = useCallback(() => {
    setConfirmDeleteId(null)
    if (view === 'list') {
      setView('editor')
      setEditorFocusSignal((value) => value + 1)
    } else {
      setView('list')
      setQuery('')
    }
  }, [view])

  const handleToggleMinimize = useCallback(() => {
    if (!settings.panelMinimized) void flushAll()
    setConfirmDeleteId(null)
    setMinimized(!settings.panelMinimized)
  }, [flushAll, setMinimized, settings.panelMinimized])

  const handleClose = useCallback(() => {
    setMinimized(false)
    void flushAll()
    onClose()
  }, [flushAll, onClose, setMinimized])

  const handleConfirmDelete = useCallback(
    (id: string) => {
      setConfirmDeleteId(null)
      void deleteNote(id)
    },
    [deleteNote]
  )

  useEffect(() => {
    if (panelState.focusToken <= 0) return
    if (settings.panelMinimized) setMinimized(false)
    if (getPageSelection().trim().length > 0) return
    if (selectedNote) setEditorFocusSignal((value) => value + 1)
  }, [panelState.focusToken])

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteId(null)
  }, [])

  usePanelKeydown({
    panelRef,
    confirmDeleteId,
    handleClose,
    handleCreate,
    handleCancelDelete,
  })

  const countSuffix = query ? ` of ${notes.length}` : ''
  const noteCountLabel = `${filteredNotes.length}${countSuffix} ${
    notes.length === 1 ? 'note' : 'notes'
  }`

  let panelContent: ReactNode
  if (view === 'list') {
    panelContent = (
      <NoteList
        notes={filteredNotes}
        totalCount={notes.length}
        query={query}
        selectedId={selectedId}
        confirmDeleteId={confirmDeleteId}
        onQueryChange={setQuery}
        onSelect={handleSelect}
        onRequestDelete={setConfirmDeleteId}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleConfirmDelete}
        onCreate={handleCreate}
      />
    )
  } else if (selectedNote) {
    panelContent = (
      <NoteEditor
        key={selectedNote.id}
        note={selectedNote}
        focusSignal={editorFocusSignal}
        getPageSelection={getPageSelection}
        onChangeContent={(content) => updateContent(selectedNote.id, content)}
        onChangeTitle={(title) => updateTitle(selectedNote.id, title)}
        onNotice={showToast}
      />
    )
  } else {
    panelContent = (
      <EmptyState
        hasNotes={notes.length > 0}
        onCreate={handleCreate}
        onBrowse={() => setView('list')}
      />
    )
  }

  const resizeProps: {
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    enable?: Enable | false
  } = { enable: false }
  if (!minimized) {
    resizeProps.minWidth = resizeLimits.minWidth
    resizeProps.maxWidth = resizeLimits.maxWidth
    resizeProps.minHeight = resizeLimits.minHeight
    resizeProps.maxHeight = resizeLimits.maxHeight
    resizeProps.enable = RESIZE_ENABLE
  }

  return (
    <Resizable
      {...PANEL_ACCESSIBILITY_PROPS}
      ref={resizableRef}
      as="section"
      size={{
        width: panelSize.width,
        height: minimized ? 'auto' : panelSize.height,
      }}
      {...resizeProps}
      handleClasses={RESIZE_HANDLE_CLASSES}
      handleStyles={RESIZE_HANDLE_STYLES}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeStop={handleResizeStop}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
      }}
      className={cx(
        'keep-notes-panel fixed z-[2147483647] flex animate-keep-notes-in flex-col overflow-hidden rounded-[14px] border border-neutral-200/80 bg-white text-neutral-900 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.5)] outline-none dark:border-neutral-700/70 dark:bg-neutral-900 dark:text-neutral-100',
        isDragging && 'select-none',
        isResizing && 'select-none'
      )}
    >
      <PanelHeader
        view={view}
        minimized={minimized}
        isDragging={isDragging}
        dragProps={headerDragProps}
        onToggleView={handleToggleView}
        onNewNote={handleCreate}
        onToggleMinimize={handleToggleMinimize}
        onClose={handleClose}
      />

      {!minimized && (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            {loadError && (
              <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  {loadError}{' '}
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="font-semibold underline decoration-amber-500/50 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {panelContent}
          </div>

          <footer className="flex h-9 shrink-0 items-center justify-between gap-2 border-t border-neutral-200/80 px-3 dark:border-neutral-800">
            <div className="min-w-0">
              {view === 'editor' && selectedNote ? (
                <SaveStatus
                  state={saveState}
                  error={saveError}
                  onRetry={() => void retrySave()}
                />
              ) : (
                <span className="text-[10.5px] text-neutral-400 dark:text-neutral-500">
                  {noteCountLabel}
                </span>
              )}
            </div>
            <ThemeToggle theme={settings.theme} onChange={setTheme} />
          </footer>
        </>
      )}

      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/95 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg animate-keep-notes-in dark:bg-neutral-100 dark:text-neutral-900"
        >
          {toast.text}
        </div>
      )}
    </Resizable>
  )
}
