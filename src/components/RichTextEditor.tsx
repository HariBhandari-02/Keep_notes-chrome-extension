import { Bold, Italic, Link2, Underline, type LucideIcon } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from 'react'
import type { FormatMarkType, NoteMark } from '../types/note'
import { cx } from '../utils/cx'
import { lineAt, lineShortcut, parseListItem, type Line } from '../utils/lineFormat'
import { toLinkHref } from '../utils/linkUrl'
import { marksEqual } from '../utils/noteMarks'
import {
  HEADING_TAG,
  LINK_ATTRIBUTE,
  placeCaretAtEnd,
  readRichText,
  readRichTextCaret,
  renderRichText,
  selectRichTextRange,
  type RichTextCaret,
  type RichTextValue,
} from '../utils/richText'
import { IconButton } from './IconButton'

export interface RichTextEditorHandle {
  focusEnd: () => void
}

interface RichTextEditorProps {
  content: string
  marks: readonly NoteMark[]
  label: string
  placeholder: string
  maxLength: number
  onChange: (content: string, marks: NoteMark[]) => void
  onNotice: (message: string) => void
  ref?: Ref<RichTextEditorHandle>
}

type FormatState = Record<FormatMarkType, boolean>

const NO_FORMATS: FormatState = { bold: false, italic: false, underline: false }

const FORMAT_CONTROLS: Array<{ type: FormatMarkType; label: string; key: string; Icon: LucideIcon }> = [
  { type: 'bold', label: 'Bold', key: 'b', Icon: Bold },
  { type: 'italic', label: 'Italic', key: 'i', Icon: Italic },
  { type: 'underline', label: 'Underline', key: 'u', Icon: Underline },
]

const MAX_LENGTH_NOTICE = 'This note is at its maximum length.'

/** Grace period for moving the pointer from a link onto its preview card. */
const LINK_PREVIEW_HIDE_MS = 180
const LINK_PREVIEW_MAX_WIDTH = 260
const LINK_PREVIEW_GAP = 4

interface LinkPreview {
  href: string
  left: number
  top: number
  above: boolean
}

/** The line box of a (possibly wrapped) link that the pointer is on. */
function hoveredLineRect(link: Element, clientX: number, clientY: number): DOMRect {
  const rects = Array.from(link.getClientRects())
  return (
    rects.find(
      (rect) =>
        clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    ) ?? link.getBoundingClientRect()
  )
}

/**
 * execCommand and queryCommandState are deprecated but are still the only browser
 * APIs that format a contenteditable selection, apply "type in bold from here"
 * state, and keep native undo/redo working. Chrome supports them inside the
 * panel's shadow root. They are reached through this narrow interface so the
 * dependency stays in one place, and each may be missing in non-browser hosts.
 */
interface EditingCommands {
  execCommand?: (command: string, showUI: boolean, value?: string) => boolean
  queryCommandState?: (command: string) => boolean
}

function editingCommands(): EditingCommands {
  return document as unknown as EditingCommands
}

function runCommand(command: string, value?: string): boolean {
  try {
    const { execCommand } = editingCommands()
    return typeof execCommand === 'function' && execCommand.call(document, command, false, value)
  } catch {
    return false
  }
}

function readFormats(): FormatState {
  try {
    const { queryCommandState } = editingCommands()
    if (typeof queryCommandState !== 'function') return NO_FORMATS
    return {
      bold: queryCommandState.call(document, 'bold'),
      italic: queryCommandState.call(document, 'italic'),
      underline: queryCommandState.call(document, 'underline'),
    }
  } catch {
    return NO_FORMATS
  }
}

function sameFormats(a: FormatState, b: FormatState): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
}

/** Keys that can start, continue, or end a list or heading line. */
const LINE_KEYS = new Set([' ', 'Enter', 'Backspace'])

/** Replaces content [start, end) through an editing command, so the change stays undoable. */
function replaceText(editor: HTMLElement, at: RichTextCaret, start: number, end: number, text: string): boolean {
  if (!selectRichTextRange(editor, start, end)) return false
  if (runCommand(text ? 'insertText' : 'delete', text || undefined)) return true
  // Put the caret back so the key's own action still happens where the user left it.
  const selection = editor.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(at.range)
  return false
}

/** A space after "-", "1", or "#" at the start of a line makes it a bullet, numbered item, or heading. */
function startLineFormat(editor: HTMLElement, at: RichTextCaret, line: Line, room: number): boolean {
  const shortcut = lineShortcut(at.content.slice(line.start, at.caret))
  if (!shortcut) return false
  if (shortcut.kind === 'heading') {
    if (!runCommand('formatBlock', HEADING_TAG)) return false
    replaceText(editor, at, line.start, at.caret, '')
    return true
  }
  const added = shortcut.marker.length - (at.caret - line.start)
  return added <= room && replaceText(editor, at, line.start, at.caret, shortcut.marker)
}

/** Enter on a list item starts the next one; on an empty item it ends the list. */
function continueList(editor: HTMLElement, at: RichTextCaret, line: Line, room: number): boolean {
  const item = parseListItem(line.text)
  if (!item || at.caret < line.start + item.marker.length) return false
  if (!line.text.slice(item.marker.length).trim()) {
    return replaceText(editor, at, line.start, line.end, '')
  }
  const text = `\n${item.next}`
  return text.length <= room && runCommand('insertText', text)
}

/** Backspace right after a list marker removes it; at the start of a heading it makes the line plain. */
function removeLineFormat(editor: HTMLElement, at: RichTextCaret, line: Line): boolean {
  const item = parseListItem(line.text)
  if (item && at.caret === line.start + item.marker.length) {
    return replaceText(editor, at, line.start, at.caret, '')
  }
  return at.caret === line.start && at.inHeading && runCommand('formatBlock', 'div')
}

export function RichTextEditor({
  content,
  marks,
  label,
  placeholder,
  maxLength,
  onChange,
  onNotice,
  ref,
}: Readonly<RichTextEditorProps>) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const renderedRef = useRef<RichTextValue | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [formats, setFormats] = useState<FormatState>(NO_FORMATS)
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      focusEnd: () => {
        const editor = editorRef.current
        if (!editor) return
        editor.focus()
        placeCaretAtEnd(editor)
      },
    }),
    []
  )

  // The DOM is owned by the browser while typing; it is only rebuilt when the
  // note changes from outside the editor (another tab, appended page text, clamping).
  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const rendered = renderedRef.current
    if (rendered?.content === content && marksEqual(rendered.marks, marks)) return

    renderRichText(editor, content, marks)
    renderedRef.current = { content, marks: [...marks] }
    if (editor.matches(':focus')) placeCaretAtEnd(editor)
  }, [content, marks])

  const syncFormats = useCallback(() => {
    const next = editorRef.current?.matches(':focus') ? readFormats() : NO_FORMATS
    setFormats((current) => (sameFormats(current, next) ? current : next))
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', syncFormats)
    return () => document.removeEventListener('selectionchange', syncFormats)
  }, [syncFormats])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleBeforeInput = (event: InputEvent) => {
      if (!event.inputType.startsWith('insert')) return
      const length = renderedRef.current?.content.length ?? 0
      const replacesText = event.getTargetRanges?.().some((range) => !range.collapsed) ?? false
      if (length >= maxLength && !replacesText) {
        event.preventDefault()
        onNotice(MAX_LENGTH_NOTICE)
      }
    }

    editor.addEventListener('beforeinput', handleBeforeInput)
    return () => editor.removeEventListener('beforeinput', handleBeforeInput)
  }, [maxLength, onNotice])

  const cancelHidePreview = useCallback(() => {
    if (!hideTimer.current) return
    clearTimeout(hideTimer.current)
    hideTimer.current = null
  }, [])

  const scheduleHidePreview = useCallback(() => {
    cancelHidePreview()
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null
      setLinkPreview(null)
    }, LINK_PREVIEW_HIDE_MS)
  }, [cancelHidePreview])

  const hidePreview = useCallback(() => {
    cancelHidePreview()
    setLinkPreview(null)
  }, [cancelHidePreview])

  useEffect(() => cancelHidePreview, [cancelHidePreview])

  const handleMouseOver = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target
    const link = target instanceof Element ? target.closest(`a[${LINK_ATTRIBUTE}]`) : null
    const href = link ? toLinkHref(link.getAttribute('href')) : null
    const surface = surfaceRef.current
    if (!link || !href || !surface) {
      if (linkPreview) scheduleHidePreview()
      return
    }

    cancelHidePreview()
    const line = hoveredLineRect(link, event.clientX, event.clientY)
    const bounds = surface.getBoundingClientRect()
    const maxLeft = Math.max(8, bounds.width - LINK_PREVIEW_MAX_WIDTH - 8)
    const left = Math.min(Math.max(8, event.clientX - bounds.left - 12), maxLeft)
    // Flip above the line when the card would run past the bottom of the editor.
    const above = line.bottom - bounds.top + 40 > bounds.height
    const top = above
      ? line.top - bounds.top - LINK_PREVIEW_GAP
      : line.bottom - bounds.top + LINK_PREVIEW_GAP

    setLinkPreview((current) =>
      current?.href === href && current.top === top && current.above === above
        ? current
        : { href, left, top, above }
    )
  }

  const emitChange = () => {
    hidePreview()
    const editor = editorRef.current
    if (!editor) return
    const value = readRichText(editor)
    renderedRef.current = value
    onChange(value.content, value.marks)
  }

  const applyFormat = (type: FormatMarkType) => {
    const editor = editorRef.current
    if (!editor) return
    if (!editor.matches(':focus')) editor.focus()
    runCommand(type)
    syncFormats()
  }

  const insertPlainText = (raw: string) => {
    const text = raw.replaceAll(/\r\n?/g, '\n')
    if (!text) return
    const available = maxLength - (renderedRef.current?.content.length ?? 0)
    if (available <= 0) {
      onNotice(MAX_LENGTH_NOTICE)
      return
    }
    const addition = text.slice(0, available)
    runCommand('insertText', addition)
    if (addition.length < text.length) onNotice('Pasted text was shortened to fit the note limit')
  }

  // Pasted and dropped content is inserted as plain text so page markup never enters the note.
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    insertPlainText(event.clipboardData.getData('text/plain'))
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    editorRef.current?.focus()
    insertPlainText(event.dataTransfer.getData('text/plain'))
  }

  /** Handles a key that edits list or heading lines; returns whether it did. */
  const applyLineFormat = (key: string, shiftKey: boolean): boolean => {
    const editor = editorRef.current
    if (!editor || !LINE_KEYS.has(key)) return false
    const at = readRichTextCaret(editor)
    if (!at) return false
    const line = lineAt(at.content, at.caret)
    const room = maxLength - at.content.length
    if (key === ' ') return startLineFormat(editor, at, line, room)
    if (key === 'Enter') return !shiftKey && continueList(editor, at, line, room)
    return removeLineFormat(editor, at, line)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.nativeEvent.isComposing) return
    if (!(event.ctrlKey || event.metaKey)) {
      if (applyLineFormat(event.key, event.shiftKey)) event.preventDefault()
      return
    }
    if (event.shiftKey) return
    const control = FORMAT_CONTROLS.find((item) => item.key === event.key.toLowerCase())
    if (!control) return
    event.preventDefault()
    applyFormat(control.type)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex shrink-0 items-center gap-0.5 px-3 pt-2"
      >
        {FORMAT_CONTROLS.map(({ type, label: controlLabel, key, Icon }) => (
          <IconButton
            key={type}
            label={controlLabel}
            title={`${controlLabel} (Ctrl/Cmd + ${key.toUpperCase()})`}
            size="sm"
            active={formats[type]}
            aria-pressed={formats[type]}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormat(type)}
          >
            <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
          </IconButton>
        ))}
      </div>

      <div ref={surfaceRef} className="relative flex min-h-0 flex-1 flex-col">
        {content.length === 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1 text-[13.5px] leading-[1.65] text-neutral-400 dark:text-neutral-500"
          >
            {placeholder}
          </div>
        )}
        {/* A rich-text field cannot be an <input> or <textarea>; role="textbox" is the
            ARIA pattern for a contenteditable editor and enables aria-multiline. */}
        <div // NOSONAR typescript:S6819
          ref={editorRef}
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          aria-placeholder={placeholder}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          tabIndex={0}
          onInput={emitChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onFocus={syncFormats}
          onBlur={syncFormats}
          onMouseOver={handleMouseOver}
          onMouseLeave={scheduleHidePreview}
          onScroll={hidePreview}
          className="keep-notes-editor keep-notes-scroll min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 pb-3 pt-1 text-[13.5px] leading-[1.65] text-neutral-800 outline-none dark:text-neutral-100"
        />

        {linkPreview && (
          <a
            href={linkPreview.href}
            target="_blank"
            rel="noopener noreferrer"
            title={linkPreview.href}
            onMouseEnter={cancelHidePreview}
            onMouseLeave={scheduleHidePreview}
            style={{ left: linkPreview.left, top: linkPreview.top, maxWidth: LINK_PREVIEW_MAX_WIDTH }}
            className={cx(
              'group absolute z-20 flex w-max items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[11px] shadow-lg outline-none animate-keep-notes-in dark:border-neutral-700 dark:bg-neutral-900',
              linkPreview.above && '-translate-y-full'
            )}
          >
            <Link2
              size={12}
              strokeWidth={2.2}
              className="shrink-0 text-neutral-400 dark:text-neutral-500"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate font-medium text-indigo-600 underline-offset-2 group-hover:underline group-focus-visible:underline dark:text-indigo-300">
              {linkPreview.href}
            </span>
          </a>
        )}
      </div>
    </div>
  )
}
