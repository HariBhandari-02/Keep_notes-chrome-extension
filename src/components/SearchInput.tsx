import { Search, X } from 'lucide-react'
import type { KeyboardEvent } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
}

export function SearchInput({ value, onChange }: Readonly<SearchInputProps>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    if (value) {
      onChange('')
    } else {
      event.currentTarget.blur()
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-2.5 ring-1 ring-transparent transition-shadow focus-within:bg-white focus-within:ring-indigo-500/60 dark:bg-neutral-800/70 dark:focus-within:bg-neutral-800">
      <Search size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search notes…"
        aria-label="Search notes"
        autoFocus
        spellCheck={false}
        className="h-8 w-full min-w-0 bg-transparent text-[12.5px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          title="Clear search"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 outline-none transition-colors hover:bg-neutral-200 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
        >
          <X size={12} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
