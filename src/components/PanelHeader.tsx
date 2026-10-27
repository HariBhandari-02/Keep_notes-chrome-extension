import { ChevronUp, Minus, NotebookText, Plus, RefreshCw, X } from 'lucide-react'
import type { HeaderDragProps } from '../hooks/useDraggable'
import type { PanelView } from '../types/note'
import { cx } from '../utils/cx'
import { BrandMark } from './BrandMark'
import { IconButton } from './IconButton'

interface PanelHeaderProps {
  view: PanelView
  minimized: boolean
  isDragging: boolean
  refreshing: boolean
  dragProps: HeaderDragProps
  onToggleView: () => void
  onRefresh: () => void
  onNewNote: () => void
  onToggleMinimize: () => void
  onClose: () => void
}

export function PanelHeader({
  view,
  minimized,
  isDragging,
  refreshing,
  dragProps,
  onToggleView,
  onRefresh,
  onNewNote,
  onToggleMinimize,
  onClose,
}: Readonly<PanelHeaderProps>) {
  return (
    <header
      {...dragProps}
      className={cx(
        'flex h-12 shrink-0 select-none items-center gap-2 border-b border-neutral-200/80 px-3 dark:border-neutral-800',
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ touchAction: 'none' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <BrandMark />
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-neutral-800 dark:text-neutral-100">
          Keep Notes
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {!minimized && (
          <IconButton
            label={view === 'list' ? 'Show note editor' : 'Show notes list'}
            onClick={onToggleView}
            active={view === 'list'}
          >
            <NotebookText size={16} strokeWidth={2} aria-hidden="true" />
          </IconButton>
        )}

        {!minimized && (
          <IconButton
            label="Refresh notes"
            title="Refresh notes from other tabs"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
          >
            <RefreshCw
              size={15}
              strokeWidth={2.1}
              className={cx(refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </IconButton>
        )}

        <IconButton label="New note" title="New note (Ctrl/Cmd + Enter)" variant="accent" onClick={onNewNote}>
          <Plus size={17} strokeWidth={2.4} aria-hidden="true" />
        </IconButton>

        <IconButton
          label={minimized ? 'Expand Keep Notes' : 'Minimize Keep Notes'}
          onClick={onToggleMinimize}
        >
          {minimized ? (
            <ChevronUp size={17} strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Minus size={17} strokeWidth={2.2} aria-hidden="true" />
          )}
        </IconButton>

        <IconButton label="Close Keep Notes" onClick={onClose}>
          <X size={17} strokeWidth={2.2} aria-hidden="true" />
        </IconButton>
      </div>
    </header>
  )
}
