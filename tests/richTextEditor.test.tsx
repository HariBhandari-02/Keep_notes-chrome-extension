// @vitest-environment jsdom
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RichTextEditor, type RichTextEditorHandle } from '../src/components/RichTextEditor'
import type { NoteMark } from '../src/types/note'

const documentWithCommands = document as unknown as {
  execCommand?: unknown
  queryCommandState?: unknown
}

let execCommand: ReturnType<typeof vi.fn>
let commandState: Record<string, boolean>

interface EditorProps {
  content?: string
  marks?: NoteMark[]
  maxLength?: number
  onChange?: (content: string, marks: NoteMark[]) => void
  onNotice?: (message: string) => void
}

function renderEditor(props: EditorProps = {}) {
  const onChange = props.onChange ?? vi.fn()
  const onNotice = props.onNotice ?? vi.fn()
  const ref = createRef<RichTextEditorHandle>()
  const element = (content: string, marks: NoteMark[]) => (
    <RichTextEditor
      ref={ref}
      content={content}
      marks={marks}
      label="Note content"
      placeholder="Start writing…"
      maxLength={props.maxLength ?? 100}
      onChange={onChange}
      onNotice={onNotice}
    />
  )
  const view = render(element(props.content ?? '', props.marks ?? []))
  const editor = screen.getByRole('textbox', { name: 'Note content' })
  return { ...view, editor, ref, element, onChange, onNotice }
}

function paste(target: HTMLElement, text: string) {
  const event = createEvent.paste(target, {
    clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  })
  fireEvent(target, event)
  return event
}

describe('RichTextEditor', () => {
  beforeEach(() => {
    commandState = { bold: false, italic: false, underline: false }
    execCommand = vi.fn(() => true)
    documentWithCommands.execCommand = execCommand
    documentWithCommands.queryCommandState = (command: string) => commandState[command] ?? false
  })

  afterEach(() => {
    delete documentWithCommands.execCommand
    delete documentWithCommands.queryCommandState
  })

  it('renders formatted content and a placeholder only when empty', () => {
    const { editor, rerender, element } = renderEditor({
      content: 'Hi there',
      marks: [{ type: 'italic', start: 3, end: 8 }],
    })

    expect(editor.querySelector('i')?.textContent).toBe('there')
    expect(screen.queryByText('Start writing…')).toBeNull()

    rerender(element('', []))
    expect(screen.getByText('Start writing…')).toBeTruthy()
    expect(editor.textContent).toBe('')
  })

  it('applies formatting from the toolbar and keeps the editor focused', () => {
    const { editor } = renderEditor({ content: 'text' })

    for (const name of ['Bold', 'Italic', 'Underline']) {
      const button = screen.getByRole('button', { name })
      const mouseDown = createEvent.mouseDown(button)
      fireEvent(button, mouseDown)
      expect(mouseDown.defaultPrevented).toBe(true)
      fireEvent.click(button)
    }

    expect(document.activeElement).toBe(editor)
    expect(execCommand.mock.calls.map((call) => call[0])).toEqual(['bold', 'italic', 'underline'])
  })

  it('applies formatting with keyboard shortcuts', () => {
    const { editor } = renderEditor({ content: 'text' })
    editor.focus()

    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true })
    fireEvent.keyDown(editor, { key: 'I', metaKey: true })
    fireEvent.keyDown(editor, { key: 'u', ctrlKey: true })
    fireEvent.keyDown(editor, { key: 'b', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(editor, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(editor, { key: 'b' })

    expect(execCommand.mock.calls.map((call) => call[0])).toEqual(['bold', 'italic', 'underline'])
  })

  it('reflects the active formats at the caret on the toolbar', () => {
    const { editor } = renderEditor({ content: 'text' })
    const bold = screen.getByRole('button', { name: 'Bold' })
    expect(bold.getAttribute('aria-pressed')).toBe('false')

    editor.focus()
    commandState.bold = true
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    expect(bold.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Italic' }).getAttribute('aria-pressed')).toBe('false')

    act(() => editor.blur())
    expect(bold.getAttribute('aria-pressed')).toBe('false')
  })

  it('emits plain text and marks when the user edits', () => {
    const { editor, onChange } = renderEditor({ content: 'start' })

    const bold = document.createElement('b')
    bold.textContent = 'new'
    editor.append(' ', bold)
    fireEvent.input(editor)

    expect(onChange).toHaveBeenCalledWith('start new', [{ type: 'bold', start: 6, end: 9 }])
  })

  it('does not rebuild the DOM for its own edits but does for outside changes', () => {
    const { editor, rerender, element, onChange } = renderEditor({ content: 'one' })
    const original = editor.firstChild

    ;(original as Text).data = 'one two'
    fireEvent.input(editor)
    expect(onChange).toHaveBeenCalledWith('one two', [])

    rerender(element('one two', []))
    expect(editor.firstChild).toBe(original)

    rerender(element('one two three', [{ type: 'underline', start: 8, end: 13 }]))
    expect(editor.firstChild).not.toBe(original)
    expect(editor.querySelector('u')?.textContent).toBe('three')
  })

  it('moves the caret to the end when content changes while focused', () => {
    const { editor, rerender, element } = renderEditor({ content: 'abc' })
    editor.focus()

    rerender(element('abc def', []))

    const range = document.getSelection()?.getRangeAt(0)
    expect(range?.endContainer).toBe(editor)
    expect(range?.endOffset).toBe(editor.childNodes.length)
  })

  it('focuses the end of the text through its handle', () => {
    const { editor, ref } = renderEditor({ content: 'abc\n' })

    act(() => ref.current?.focusEnd())

    expect(document.activeElement).toBe(editor)
    expect(document.getSelection()?.getRangeAt(0).startContainer).toBe(editor.lastChild)
  })

  it('pastes clipboard content as plain text', () => {
    const { editor } = renderEditor({ content: 'abc' })

    const event = paste(editor, 'line one\r\nline two')

    expect(event.defaultPrevented).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'line one\nline two')
  })

  it('ignores an empty paste', () => {
    const { editor } = renderEditor({ content: 'abc' })
    paste(editor, '')
    expect(execCommand).not.toHaveBeenCalled()
  })

  it('shortens pasted text to the remaining space', () => {
    const { editor, onNotice } = renderEditor({ content: 'abcdef', maxLength: 10 })

    paste(editor, '123456789')

    expect(execCommand).toHaveBeenCalledWith('insertText', false, '1234')
    expect(onNotice).toHaveBeenCalledWith('Pasted text was shortened to fit the note limit')
  })

  it('refuses to paste into a full note', () => {
    const { editor, onNotice } = renderEditor({ content: 'abcdef', maxLength: 6 })

    paste(editor, 'more')

    expect(execCommand).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith('This note is at its maximum length.')
  })

  it('inserts dropped content as plain text', () => {
    const { editor } = renderEditor({ content: 'abc' })

    const event = createEvent.drop(editor, {
      dataTransfer: { getData: (type: string) => (type === 'text/plain' ? 'dropped' : '') },
    })
    fireEvent(editor, event)

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(editor)
    expect(execCommand).toHaveBeenCalledWith('insertText', false, 'dropped')
  })

  it('allows replacing a selection when the note is full', () => {
    const { editor, onNotice } = renderEditor({ content: 'abcdef', maxLength: 6 })

    const event = new InputEvent('beforeinput', { inputType: 'insertText', data: 'x', cancelable: true })
    Object.defineProperty(event, 'getTargetRanges', {
      value: () => [{ collapsed: false }],
    })
    editor.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(onNotice).not.toHaveBeenCalled()
  })

  it('falls back safely when editing commands are unavailable', () => {
    delete documentWithCommands.execCommand
    delete documentWithCommands.queryCommandState
    const { editor } = renderEditor({ content: 'text' })
    editor.focus()

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Bold' }))).not.toThrow()
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('treats throwing editing commands as unsupported', () => {
    documentWithCommands.execCommand = () => {
      throw new Error('unsupported')
    }
    documentWithCommands.queryCommandState = () => {
      throw new Error('unsupported')
    }
    const { editor } = renderEditor({ content: 'text' })
    editor.focus()

    expect(() => fireEvent.keyDown(editor, { key: 'b', ctrlKey: true })).not.toThrow()
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false')
  })

  describe('list and heading lines', () => {
    let calls: Array<[string, string | undefined, string]>

    beforeEach(() => {
      calls = []
      execCommand = vi.fn((command: string, _showUI: boolean, value?: string) => {
        calls.push([command, value, document.getSelection()?.toString() ?? ''])
        return true
      })
      documentWithCommands.execCommand = execCommand
    })

    function placeCaret(node: Node, offset: number) {
      const range = document.createRange()
      range.setStart(node, offset)
      range.collapse(true)
      document.getSelection()?.removeAllRanges()
      document.getSelection()?.addRange(range)
    }

    function renderAtEnd(props: EditorProps) {
      const view = renderEditor(props)
      view.editor.focus()
      placeCaret(view.editor.lastChild!, (view.editor.lastChild as Text).length)
      return view
    }

    it('turns "- " into a bullet and "1 " into a numbered item', () => {
      const { editor } = renderAtEnd({ content: 'x\n-' })
      expect(fireEvent.keyDown(editor, { key: ' ' })).toBe(false)
      expect(calls).toEqual([['insertText', '• ', '-']])

      calls = []
      cleanup()
      const numbered = renderAtEnd({ content: '1' })
      expect(fireEvent.keyDown(numbered.editor, { key: ' ' })).toBe(false)
      expect(calls).toEqual([['insertText', '1. ', '1']])
    })

    it('turns "# " into a heading line', () => {
      const { editor } = renderAtEnd({ content: 'x\n#' })

      expect(fireEvent.keyDown(editor, { key: ' ' })).toBe(false)
      expect(calls).toEqual([
        ['formatBlock', 'h3', ''],
        ['delete', undefined, '#'],
      ])
    })

    it('leaves a space typed anywhere else alone', () => {
      const { editor } = renderAtEnd({ content: 'a-' })

      expect(fireEvent.keyDown(editor, { key: ' ' })).toBe(true)
      expect(fireEvent.keyDown(editor, { key: ' ', isComposing: true })).toBe(true)
      expect(calls).toEqual([])
    })

    it('continues a list on Enter and ends it on Enter in an empty item', () => {
      const { editor } = renderAtEnd({ content: '1. a' })
      expect(fireEvent.keyDown(editor, { key: 'Enter' })).toBe(false)
      expect(calls).toEqual([['insertText', '\n2. ', '']])

      calls = []
      cleanup()
      const empty = renderAtEnd({ content: '• a\n• ' })
      expect(fireEvent.keyDown(empty.editor, { key: 'Enter' })).toBe(false)
      expect(calls).toEqual([['delete', undefined, '• ']])
    })

    it('keeps Shift+Enter and Enter outside a list as plain line breaks', () => {
      const { editor } = renderAtEnd({ content: '• a' })
      expect(fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true })).toBe(true)

      cleanup()
      const plain = renderAtEnd({ content: 'text' })
      expect(fireEvent.keyDown(plain.editor, { key: 'Enter' })).toBe(true)
      expect(calls).toEqual([])
    })

    it('removes a list marker on Backspace right after it', () => {
      const { editor } = renderEditor({ content: '1. a\n2. b' })
      editor.focus()
      placeCaret(editor.firstChild!, 8)

      expect(fireEvent.keyDown(editor, { key: 'Backspace' })).toBe(false)
      expect(calls).toEqual([['delete', undefined, '2. ']])

      calls = []
      placeCaret(editor.firstChild!, 9)
      expect(fireEvent.keyDown(editor, { key: 'Backspace' })).toBe(true)
      expect(calls).toEqual([])
    })

    it('makes a heading plain on Backspace at its start', () => {
      const { editor } = renderEditor({
        content: 'a\nTitle',
        marks: [{ type: 'heading', start: 2, end: 7 }],
      })
      editor.focus()
      const heading = editor.querySelector('h3')!.firstChild!

      placeCaret(heading, 1)
      expect(fireEvent.keyDown(editor, { key: 'Backspace' })).toBe(true)

      placeCaret(heading, 0)
      expect(fireEvent.keyDown(editor, { key: 'Backspace' })).toBe(false)
      expect(calls).toEqual([['formatBlock', 'div', '']])
    })

    it('lets the key through and restores the caret when the edit fails', () => {
      execCommand.mockReturnValue(false)
      const { editor } = renderAtEnd({ content: '-' })

      expect(fireEvent.keyDown(editor, { key: ' ' })).toBe(true)
      const range = document.getSelection()?.getRangeAt(0)
      expect(range?.collapsed).toBe(true)
      expect(range?.startOffset).toBe(1)
    })

    it('does not grow a note that is at its maximum length', () => {
      const { editor } = renderAtEnd({ content: '• a', maxLength: 3 })
      expect(fireEvent.keyDown(editor, { key: 'Enter' })).toBe(true)

      cleanup()
      const numbered = renderAtEnd({ content: '1', maxLength: 2 })
      expect(fireEvent.keyDown(numbered.editor, { key: ' ' })).toBe(true)
      expect(calls).toEqual([])
    })
  })
})
