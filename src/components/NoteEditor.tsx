import { ClipboardPlus } from 'lucide-react'
import { useEffect, useRef, useState, type FocusEvent } from 'react'
import type { Note } from '../types/note'
import { deriveTitleInputValue } from '../utils/generateTitle'
import { formatRelativeTime } from '../utils/noteUtils'

interface NoteEditorProps {
  note: Note
  focusSignal: number
  getPageSelection: () => string
  onChangeContent: (content: string) => void
  onChangeTitle: (title: string) => void
  onNotice: (message: string) => void
}

export function NoteEditor({
  note,
  focusSignal,
  getPageSelection,
  onChangeContent,
  onChangeTitle,
  onNotice,
}: NoteEditorProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const autoTitle = deriveTitleInputValue(note.content)
  const titleValue = editingTitle
    ? titleDraft
    : note.customTitle
      ? note.title
      : autoTitle
  const titlePlaceholder = note.customTitle ? 'Add a title…' : autoTitle || 'Untitled note'

  useEffect(() => {
    setEditingTitle(false)
    setTitleDraft('')
  }, [note.id])

  useEffect(() => {
    if (focusSignal <= 0) return
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    const end = textarea.value.length
    textarea.setSelectionRange(end, end)
  }, [focusSignal])

  const handleTitleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setEditingTitle(true)
    setTitleDraft(note.customTitle ? note.title : autoTitle)
    if (!note.customTitle) {
      event.currentTarget.select()
    }
  }

  const handleTitleChange = (value: string) => {
    setEditingTitle(true)
    setTitleDraft(value)
    onChangeTitle(value)
  }

  const handleAddSelection = () => {
    const selection = getPageSelection()
    if (!selection.trim()) {
      onNotice('Select some text on the page first.')
      return
    }

    const separator = !note.content ? '' : note.content.endsWith('\n') ? '\n' : '\n\n'
    const nextContent = `${note.content}${separator}${selection.trim()}`
    onChangeContent(nextContent)
    onNotice('Selected text added to note')
    setEditingTitle(false)

    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(nextContent.length, nextContent.length)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-3">
        <input
          ref={titleRef}
          type="text"
          value={titleValue}
          onChange={(event) => handleTitleChange(event.target.value)}
          onFocus={handleTitleFocus}
          onBlur={() => setEditingTitle(false)}
          placeholder={titlePlaceholder}
          aria-label="Note title"
          spellCheck={false}
          className="w-full rounded-md border-0 bg-transparent px-0.5 text-[17px] font-semibold leading-6 tracking-[-0.015em] text-neutral-900 outline-none placeholder:font-medium placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-neutral-50 dark:placeholder:text-neutral-500"
        />

        <div className="mt-1 flex items-center justify-between gap-3 pb-2 text-[10.5px] text-neutral-400 dark:text-neutral-500">
          <span className="truncate">Edited {formatRelativeTime(note.updatedAt)}</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleAddSelection}
            title="Add the current page text selection to this note"
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <ClipboardPlus size={11.5} strokeWidth={2.2} aria-hidden="true" />
            Add selected text
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={note.content}
        onChange={(event) => onChangeContent(event.target.value)}
        placeholder="Start writing…"
        aria-label="Note content"
        spellCheck
        className="keep-notes-editor keep-notes-scroll min-h-0 flex-1 resize-none border-0 bg-transparent px-4 pb-3 pt-1 text-[13.5px] leading-[1.65] text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
      />
    </div>
  )
}
