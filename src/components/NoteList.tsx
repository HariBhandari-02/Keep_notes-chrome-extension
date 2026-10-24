import { FilePlus2, Inbox, SearchX, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Note } from '../types/note'
import { cx } from '../utils/cx'
import { contentPreview, displayTitle, formatRelativeTime } from '../utils/noteUtils'
import { SearchInput } from './SearchInput'

interface NoteListProps {
  notes: Note[]
  totalCount: number
  query: string
  selectedId: string | null
  confirmDeleteId: string | null
  onQueryChange: (value: string) => void
  onSelect: (id: string) => void
  onRequestDelete: (id: string) => void
  onCancelDelete: () => void
  onConfirmDelete: (id: string) => void
  onCreate: () => void
}

export function NoteList({
  notes,
  totalCount,
  query,
  selectedId,
  confirmDeleteId,
  onQueryChange,
  onSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onCreate,
}: Readonly<NoteListProps>) {
  let content: ReactNode

  if (notes.length > 0) {
    content = (
      <ul className="space-y-1" aria-label="Saved notes">
        {notes.map((note) => {
          const title = displayTitle(note)
          const preview = contentPreview(note.content)
          const isSelected = note.id === selectedId
          const isConfirming = note.id === confirmDeleteId

          return (
            <li key={note.id} className="relative">
              <div
                className={cx(
                  'group relative flex items-stretch overflow-hidden rounded-xl border transition-colors',
                  isSelected
                    ? 'border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                    : 'border-transparent hover:border-neutral-200/80 hover:bg-neutral-50 dark:hover:border-neutral-700/70 dark:hover:bg-neutral-800/50'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(note.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/70"
                >
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate text-[12.5px] font-medium text-neutral-800 dark:text-neutral-100">
                      {title}
                    </span>
                  </div>
                  <p
                    className={cx(
                      'keep-notes-line-clamp-2 mt-0.5 text-[11.5px] leading-[1.45]',
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

                <div className="flex shrink-0 items-center pr-1.5">
                  <button
                    type="button"
                    onClick={() => onRequestDelete(note.id)}
                    aria-label="Delete note"
                    title="Delete note"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 opacity-0 outline-none transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500/70 group-hover:opacity-100 [@media(hover:none)]:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <Trash2 size={13.5} strokeWidth={2} aria-hidden="true" />
                  </button>
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
  } else if (query) {
    content = (
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <SearchX size={24} className="text-neutral-300 dark:text-neutral-600" aria-hidden="true" />
        <p className="mt-3 text-[12.5px] font-medium text-neutral-700 dark:text-neutral-200">
          No notes match “{query}”
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
        <SearchInput value={query} onChange={onQueryChange} />
      </div>

      <div className="keep-notes-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">{content}</div>
    </div>
  )
}
