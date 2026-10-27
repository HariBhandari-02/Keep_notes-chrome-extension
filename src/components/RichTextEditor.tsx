import { Bold, Italic, Underline, type LucideIcon } from 'lucide-react'
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
  type Ref,
} from 'react'
import type { NoteMark, NoteMarkType } from '../types/note'
import { marksEqual } from '../utils/noteMarks'
import {
  placeCaretAtEnd,
  readRichText,
  renderRichText,
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

type FormatState = Record<NoteMarkType, boolean>

const NO_FORMATS: FormatState = { bold: false, italic: false, underline: false }

const FORMAT_CONTROLS: Array<{ type: NoteMarkType; label: string; key: string; Icon: LucideIcon }> = [
  { type: 'bold', label: 'Bold', key: 'b', Icon: Bold },
  { type: 'italic', label: 'Italic', key: 'i', Icon: Italic },
  { type: 'underline', label: 'Underline', key: 'u', Icon: Underline },
]

const MAX_LENGTH_NOTICE = 'This note is at its maximum length.'

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
  const [formats, setFormats] = useState<FormatState>(NO_FORMATS)

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

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) return
    const value = readRichText(editor)
    renderedRef.current = value
    onChange(value.content, value.marks)
  }

  const applyFormat = (type: NoteMarkType) => {
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
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

      <div className="relative flex min-h-0 flex-1 flex-col">
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
          className="keep-notes-editor keep-notes-scroll min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-4 pb-3 pt-1 text-[13.5px] leading-[1.65] text-neutral-800 outline-none dark:text-neutral-100"
        />
      </div>
    </div>
  )
}
