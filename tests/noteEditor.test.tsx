// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteEditor } from '../src/components/NoteEditor'
import type { Note, NoteMark } from '../src/types/note'
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_TITLE_LENGTH,
} from '../src/utils/noteLimits'

const PAGE_URL = 'https://example.com/article?id=7'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Title',
    customTitle: true,
    content: 'First line',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

interface EditorProps {
  note?: Note
  focusSignal?: number
  getPageSelection?: () => string
  getPageUrl?: () => string
  onChangeContent?: (content: string, marks?: NoteMark[]) => void
  onChangeTitle?: (title: string) => void
  onNotice?: (message: string) => void
}

function renderEditor(props: EditorProps = {}) {
  const onChangeContent = props.onChangeContent ?? vi.fn()
  const onChangeTitle = props.onChangeTitle ?? vi.fn()
  const onNotice = props.onNotice ?? vi.fn()
  const element = (focusSignal: number) => (
    <NoteEditor
      note={props.note ?? makeNote()}
      focusSignal={focusSignal}
      getPageSelection={props.getPageSelection ?? (() => '')}
      getPageUrl={props.getPageUrl ?? (() => PAGE_URL)}
      onChangeContent={onChangeContent}
      onChangeTitle={onChangeTitle}
      onNotice={onNotice}
    />
  )

  const view = render(element(props.focusSignal ?? 0))
  return { ...view, onChangeContent, onChangeTitle, onNotice, element }
}

describe('NoteEditor', () => {
  it('appends selected page text after a blank line', () => {
    const onChangeContent = vi.fn()
    const onNotice = vi.fn()
    renderEditor({
      getPageSelection: () => '  selected words  ',
      onChangeContent,
      onNotice,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))

    expect(onChangeContent).toHaveBeenCalledWith('First line\n\nselected words\n', [
      { type: 'link', start: 12, end: 26, href: PAGE_URL },
    ])
    expect(onNotice).toHaveBeenCalledWith('Selected text added to note')
  })

  it('keeps existing formatting when linking added page text', () => {
    const onChangeContent = vi.fn()
    renderEditor({
      note: makeNote({ content: 'Bold', marks: [{ type: 'bold', start: 0, end: 4 }] }),
      getPageSelection: () => 'quote',
      onChangeContent,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))
    expect(onChangeContent).toHaveBeenCalledWith('Bold\n\nquote\n', [
      { type: 'bold', start: 0, end: 4 },
      { type: 'link', start: 6, end: 11, href: PAGE_URL },
    ])
  })

  it('adds page text without a link when the page URL is not http(s)', () => {
    const onChangeContent = vi.fn()
    renderEditor({
      getPageSelection: () => 'local text',
      getPageUrl: () => 'file:///home/user/secret.html',
      onChangeContent,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))
    expect(onChangeContent).toHaveBeenCalledWith('First line\n\nlocal text')
  })

  it('shows the source URL when hovering linked text', async () => {
    renderEditor({
      note: makeNote({
        content: 'See quote here',
        marks: [{ type: 'link', start: 4, end: 9, href: PAGE_URL }],
      }),
    })

    const content = screen.getByRole('textbox', { name: 'Note content' })
    const link = content.querySelector('a[data-keep-notes-link]') as HTMLAnchorElement
    expect(link.textContent).toBe('quote')
    expect(link.getAttribute('href')).toBe(PAGE_URL)

    fireEvent.mouseOver(link)
    const preview = await screen.findByRole('link', { name: PAGE_URL })
    expect(preview.getAttribute('target')).toBe('_blank')
    expect(preview.getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.mouseLeave(content)
    await waitFor(() => expect(screen.queryByRole('link', { name: PAGE_URL })).toBeNull())
  })

  it('adds a separator newline when content already ends with one', () => {
    const onChangeContent = vi.fn()
    renderEditor({
      note: makeNote({ content: 'First line\n' }),
      getPageSelection: () => 'next',
      onChangeContent,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))
    expect(onChangeContent).toHaveBeenCalledWith('First line\n\nnext\n', [
      { type: 'link', start: 12, end: 16, href: PAGE_URL },
    ])
  })

  it('appends to an empty note without a separator', () => {
    const onChangeContent = vi.fn()
    renderEditor({
      note: makeNote({ content: '' }),
      getPageSelection: () => 'fresh',
      onChangeContent,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))
    expect(onChangeContent).toHaveBeenCalledWith('fresh\n', [
      { type: 'link', start: 0, end: 5, href: PAGE_URL },
    ])
  })

  it('warns when there is no page selection', () => {
    const onChangeContent = vi.fn()
    const onNotice = vi.fn()
    renderEditor({ getPageSelection: () => '   ', onChangeContent, onNotice })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))

    expect(onNotice).toHaveBeenCalledWith('Select some text on the page first.')
    expect(onChangeContent).not.toHaveBeenCalled()
  })

  it('focuses the body editor when the focus signal changes', async () => {
    const { element, rerender } = renderEditor({ focusSignal: 0 })
    const body = screen.getByRole('textbox', { name: 'Note content' })
    const focus = vi.spyOn(body, 'focus')

    rerender(element(1))

    await waitFor(() => expect(focus).toHaveBeenCalled())
  })

  it('bounds the title and content inputs with explicit limits', () => {
    const onNotice = vi.fn()
    renderEditor({ note: makeNote({ content: 'a'.repeat(MAX_NOTE_CONTENT_LENGTH) }), onNotice })

    const title = screen.getByRole('textbox', { name: 'Note title' }) as HTMLInputElement
    expect(title.maxLength).toBe(MAX_NOTE_TITLE_LENGTH)

    const content = screen.getByRole('textbox', { name: 'Note content' })
    const typing = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'b',
      cancelable: true,
    })
    content.dispatchEvent(typing)
    expect(typing.defaultPrevented).toBe(true)
    expect(onNotice).toHaveBeenCalledWith('This note is at its maximum length.')

    const deleting = new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      cancelable: true,
    })
    content.dispatchEvent(deleting)
    expect(deleting.defaultPrevented).toBe(false)
  })

  it('separates the title from a formatted body', () => {
    renderEditor({
      note: makeNote({
        content: 'Bold and plain',
        marks: [{ type: 'bold', start: 0, end: 4 }],
      }),
    })

    const content = screen.getByRole('textbox', { name: 'Note content' })
    expect(content.querySelector('b')?.textContent).toBe('Bold')
    expect(screen.getByRole('toolbar', { name: 'Text formatting' })).toBeTruthy()
  })

  it('truncates an oversized page selection instead of exceeding the note limit', () => {
    const onChangeContent = vi.fn()
    const onNotice = vi.fn()
    const content = 'a'.repeat(MAX_NOTE_CONTENT_LENGTH - 10)
    renderEditor({
      note: makeNote({ content }),
      getPageSelection: () => 'b'.repeat(100),
      onChangeContent,
      onNotice,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))

    const appended = onChangeContent.mock.calls[0][0] as string
    expect(appended).toHaveLength(MAX_NOTE_CONTENT_LENGTH)
    expect(appended.endsWith('b'.repeat(8))).toBe(true)
    expect(onNotice).toHaveBeenCalledWith('Selected text was shortened to fit the note limit')
  })

  it('does not append page text when the note is already full', () => {
    const onChangeContent = vi.fn()
    const onNotice = vi.fn()
    renderEditor({
      note: makeNote({ content: 'a'.repeat(MAX_NOTE_CONTENT_LENGTH) }),
      getPageSelection: () => 'too much',
      onChangeContent,
      onNotice,
    })

    fireEvent.click(screen.getByRole('button', { name: /Add selected text/ }))

    expect(onChangeContent).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith('This note is at its maximum length.')
  })
})
