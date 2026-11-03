import {
  ChevronRight,
  FilePlus2,
  Inbox,
  List,
  Pin,
  SearchX,
  type LucideIcon,
} from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Note, NoteFilter } from '../types/note'
import { cx } from '../utils/cx'
import { contentPreview, displayTitle, formatRelativeTime } from '../utils/noteUtils'
import { NoteMenu } from './NoteMenu'
import { SearchInput } from './SearchInput'

interface NoteListProps {
  /** Already narrowed by `query` and `filter`. */
  notes: Note[]
  totalCount: number
  query: string
  filter: NoteFilter
  selectedId: string | null
  confirmDeleteId: string | null
  onQueryChange: (value: string) => void
  onFilterChange: (filter: NoteFilter) => void
  onSelect: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
  onRequestDelete: (id: string) => void
  onCancelDelete: () => void
  onConfirmDelete: (id: string) => void
  onCreate: () => void
}

const FILTER_TABS: ReadonlyArray<{ value: NoteFilter; label: string; Icon: LucideIcon }> = [
  { value: 'all', label: 'All notes', Icon: List },
  { value: 'pinned', label: 'Pinned notes', Icon: Pin },
]

function FilterTabs({
  filter,
  idPrefix,
  panelId,
  onChange,
}: Readonly<{
  filter: NoteFilter
  idPrefix: string
  panelId: string
  onChange: (filter: NoteFilter) => void
}>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = FILTER_TABS.findIndex((tab) => tab.value === filter)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % FILTER_TABS.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + FILTER_TABS.length) % FILTER_TABS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = FILTER_TABS.length - 1

    if (nextIndex === null) return
    event.preventDefault()
    onChange(FILTER_TABS[nextIndex].value)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [nextIndex]?.focus({ preventScroll: true })
  }

  return (
    <div
      role="tablist"
      aria-label="Filter notes"
      className="mx-auto mb-2 flex w-fit overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
    >
      {FILTER_TABS.map(({ value, label, Icon }) => {
        const selected = value === filter
        return (
          <button
            key={value}
            id={`${idPrefix}-${value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            aria-label={label}
            title={label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(value)}
            onKeyDown={handleKeyDown}
            className={cx(
              'inline-flex h-7 w-9 items-center justify-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/70',
              selected
                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
            )}
          >
            <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

export function NoteList({
  notes,
  totalCount,
  query,
  filter,
  selectedId,
  confirmDeleteId,
  onQueryChange,
  onFilterChange,
  onSelect,
  onTogglePin,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onCreate,
}: Readonly<NoteListProps>) {
  const [pinnedOpen, setPinnedOpen] = useState(true)
  const tabsId = useId()
  const panelId = `${tabsId}-panel`
  let content: ReactNode

  const renderNotes = (items: Note[], label: string) => (
    <ul className="space-y-1.5" aria-label={label}>
      {items.map((note) => {
        const title = displayTitle(note)
        const preview = contentPreview(note.content)
        const isSelected = note.id === selectedId
        const isConfirming = note.id === confirmDeleteId

        return (
          <li key={note.id} className="relative">
            <div
              className={cx(
                'relative flex items-start rounded-xl transition-colors',
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-500/10'
                  : 'bg-neutral-100/70 hover:bg-neutral-100 dark:bg-neutral-800/50 dark:hover:bg-neutral-800'
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(note.id)}
                aria-current={isSelected ? 'true' : undefined}
                className="min-w-0 flex-1 rounded-xl py-2.5 pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/70"
              >
                <span
                  className={cx(
                    'block truncate text-[12.5px] font-medium',
                    isSelected
                      ? 'text-indigo-700 dark:text-indigo-200'
                      : 'text-neutral-800 dark:text-neutral-100'
                  )}
                >
                  {title}
                </span>
                <p
                  className={cx(
                    'mt-0.5 truncate text-[11.5px] leading-[1.45]',
                    preview
                      ? 'text-neutral-500 dark:text-neutral-400'
                      : 'italic text-neutral-400 dark:text-neutral-500'
                  )}
                >
                  {preview || 'No content yet'}
                </p>
                <p className="mt-1 text-[10.5px] text-neutral-400 dark:text-neutral-500">
                  {formatRelativeTime(note.updatedAt)}
                </p>
              </button>

              <div className="shrink-0 pr-1.5 pt-2">
                <NoteMenu
                  pinned={note.pinned === true}
                  onTogglePin={() => onTogglePin(note.id, note.pinned !== true)}
                  onDelete={() => onRequestDelete(note.id)}
                />
              </div>
            </div>

            {isConfirming && (
              <div className="absolute inset-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 dark:border-red-500/30 dark:bg-red-950/80">
                <span className="min-w-0 truncate text-[11.5px] font-medium text-red-700 dark:text-red-300">
                  Delete this note?
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    autoFocus
                    onClick={onCancelDelete}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-neutral-600 outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirmDelete(note.id)}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white outline-none transition-colors hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-1 dark:bg-red-600 dark:hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )

  if (notes.length > 0 && filter === 'pinned') {
    content = <div className="pt-0.5">{renderNotes(notes, 'Pinned notes')}</div>
  } else if (notes.length > 0) {
    const pinned = notes.filter((note) => note.pinned === true)
    const others = notes.filter((note) => note.pinned !== true)
    // Search results stay visible even when the user has collapsed the pinned group.
    const showPinned = pinnedOpen || query.length > 0

    content = (
      <div className="pt-0.5">
        {pinned.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setPinnedOpen((value) => !value)}
              aria-expanded={showPinned}
              className="mb-1 flex items-center gap-1 rounded-md px-1 py-1 text-[11.5px] font-semibold text-neutral-600 outline-none transition-colors hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:text-neutral-300 dark:hover:text-neutral-100"
            >
              <ChevronRight
                size={13}
                strokeWidth={2.4}
                className={cx('transition-transform', showPinned && 'rotate-90')}
                aria-hidden="true"
              />
              Pinned ({pinned.length})
            </button>
            {showPinned && renderNotes(pinned, 'Pinned notes')}
          </section>
        )}

        {pinned.length > 0 && others.length > 0 && (
          <div className="mx-1 my-2.5 border-t border-neutral-200 dark:border-neutral-800" />
        )}

        {others.length > 0 && renderNotes(others, 'Saved notes')}
      </div>
    )
  } else if (query) {
    content = (
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <SearchX size={24} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
        <p className="mt-3 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
          No {filter === 'pinned' ? 'pinned notes' : 'notes'} match “{query}”
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          Try a different word or clear the search.
        </p>
        <button
          type="button"
          onClick={() => onQueryChange('')}
          className="mt-3 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11.5px] font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Clear search
        </button>
      </div>
    )
  } else if (filter === 'pinned') {
    content = (
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
          <Pin size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="mt-3 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
          No pinned notes
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          Pin a note from its menu to keep it here.
        </p>
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className="mt-3 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11.5px] font-medium text-neutral-700 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Show all notes
        </button>
      </div>
    )
  } else {
    content = (
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
          <Inbox size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="mt-3 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
          {totalCount === 0 ? 'No notes yet' : 'Nothing here yet'}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-neutral-400 dark:text-neutral-500">
          {totalCount === 0
            ? 'Capture a thought without leaving this page.'
            : 'Create a new note to keep going.'}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11.5px] font-medium text-white outline-none transition-colors hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-neutral-900"
        >
          <FilePlus2 size={13} strokeWidth={2.2} aria-hidden="true" />
          New note
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2 pt-3">
        <FilterTabs
          filter={filter}
          idPrefix={tabsId}
          panelId={panelId}
          onChange={onFilterChange}
        />
        <SearchInput value={query} onChange={onQueryChange} />
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${filter}`}
        className="keep-notes-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {content}
      </div>
    </div>
  )
}
