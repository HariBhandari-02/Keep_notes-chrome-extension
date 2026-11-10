import { ClipboardPlus } from 'lucide-react'
import { useEffect, useRef, useState, type FocusEvent } from 'react'
import type { Note, NoteMark } from '../types/note'
import { deriveTitleInputValue } from '../utils/generateTitle'
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
} from '../utils/noteLimits'
import { toLinkHref } from '../utils/linkUrl'
import { formatRelativeTime } from '../utils/noteUtils'
import { RichTextEditor, type RichTextEditorHandle } from './RichTextEditor'

const NO_MARKS: NoteMark[] = []

function currentPageUrl(): string {
  return globalThis.location?.href ?? ''
}

interface NoteEditorProps {
  note: Note
  focusSignal: number
  getPageSelection: () => string
  /** URL saved with text added from the page; defaults to the current page. */
  getPageUrl?: () => string
  onChangeContent: (content: string, marks?: NoteMark[]) => void
  onChangeTitle: (title: string) => void
  onNotice: (message: string) => void
}

export function NoteEditor({
  note,
  focusSignal,
  getPageSelection,
  getPageUrl = currentPageUrl,
  onChangeContent,
  onChangeTitle,
  onNotice,
}: Readonly<NoteEditorProps>) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleRef = useRef<HTMLInputElement | null>(null)
  const bodyRef = useRef<RichTextEditorHandle | null>(null)

  const autoTitle = deriveTitleInputValue(note.content)
  let titleValue = autoTitle
  if (editingTitle) {
    titleValue = titleDraft
  } else if (note.customTitle) {
    titleValue = note.title
  }
  const titlePlaceholder = note.customTitle ? 'Add a title…' : autoTitle || 'Untitled note'

  useEffect(() => {
    setEditingTitle(false)
    setTitleDraft('')
  }, [note.id])

  useEffect(() => {
    if (focusSignal <= 0) return
    bodyRef.current?.focusEnd()
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
    const selection = getPageSelection().trim()
    if (!selection) {
      onNotice('Select some text on the page first.')
      return
    }

    let separator = ''
    if (note.content) {
      separator = note.content.endsWith('\n') ? '\n' : '\n\n'
    }

    const available = MAX_NOTE_CONTENT_LENGTH - note.content.length - separator.length
    if (available <= 0) {
      onNotice('This note is at its maximum length.')
      return
    }

    const addition = selection.slice(0, available)
    const start = note.content.length + separator.length
    const href = toLinkHref(getPageUrl())
    if (href) {
      // The trailing line break leaves the caret outside the link, so typing
      // after the clip does not extend it.
      const lineBreak = start + addition.length < MAX_NOTE_CONTENT_LENGTH ? '\n' : ''
      const link: NoteMark = { type: 'link', start, end: start + addition.length, href }
      onChangeContent(`${note.content}${separator}${addition}${lineBreak}`, [
        ...(note.marks ?? NO_MARKS),
        link,
      ])
    } else {
      onChangeContent(`${note.content}${separator}${addition}`)
    }
    onNotice(
      addition.length < selection.length
        ? 'Selected text was shortened to fit the note limit'
        : 'Selected text added to note'
    )
    setEditingTitle(false)

    requestAnimationFrame(() => bodyRef.current?.focusEnd())
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-3 border-b border-neutral-300/80 px-1 pt-3 dark:border-white/15">
        <input
          ref={titleRef}
          type="text"
          value={titleValue}
          onChange={(event) => handleTitleChange(event.target.value)}
          onFocus={handleTitleFocus}
          onBlur={() => setEditingTitle(false)}
          placeholder={titlePlaceholder}
          aria-label="Note title"
          maxLength={MAX_NOTE_TITLE_LENGTH}
          spellCheck={false}
          className="w-full rounded-md border-0 bg-transparent px-0.5 text-[17px] font-semibold leading-6 tracking-[-0.015em] text-neutral-900 outline-none placeholder:font-medium placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-neutral-50 dark:placeholder:text-neutral-500"
        />

        <div className="mt-1 flex items-center justify-between gap-3 pb-2.5 text-[10.5px] text-neutral-400 dark:text-neutral-500">
          <span className="truncate">Edited {formatRelativeTime(note.updatedAt)}</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleAddSelection}
            title="Add the current page text selection to this note, with a link back to this page"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-600 outline-none transition-colors hover:border-indigo-300 hover:bg-indigo-100 hover:text-indigo-700 active:bg-indigo-200 focus-visible:ring-2 focus-visible:ring-indigo-500/70 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400/50 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
          >
            <ClipboardPlus size={12.5} strokeWidth={2.2} aria-hidden="true" />
            Add selected text
          </button>
        </div>
      </div>

      <RichTextEditor
        ref={bodyRef}
        content={note.content}
        marks={note.marks ?? NO_MARKS}
        label="Note content"
        placeholder="Start writing…"
        maxLength={MAX_NOTE_CONTENT_LENGTH}
        onChange={onChangeContent}
        onNotice={onNotice}
      />
    </div>
  )
}
