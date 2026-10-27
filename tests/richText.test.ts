// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { NoteMark } from '../src/types/note'
import { placeCaretAtEnd, readRichText, renderRichText } from '../src/utils/richText'

function makeEditor(): HTMLDivElement {
  const editor = document.createElement('div')
  editor.contentEditable = 'true'
  document.body.appendChild(editor)
  return editor
}

function setMarkup(editor: HTMLElement, build: (doc: Document) => Node[]): void {
  editor.replaceChildren(...build(document))
}

function el(tag: string, children: Array<Node | string>, style?: string): HTMLElement {
  const element = document.createElement(tag)
  if (style) element.setAttribute('style', style)
  element.append(...children)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('renderRichText', () => {
  it('wraps formatted runs in b, i, and u elements', () => {
    const editor = makeEditor()
    const marks: NoteMark[] = [
      { type: 'bold', start: 0, end: 4 },
      { type: 'italic', start: 2, end: 6 },
      { type: 'underline', start: 7, end: 9 },
    ]
    renderRichText(editor, 'abcdef ghi', marks)

    expect(editor.textContent).toBe('abcdef ghi')
    expect(Array.from(editor.querySelectorAll('b')).map((node) => node.textContent)).toEqual([
      'ab',
      'cd',
    ])
    expect(Array.from(editor.querySelectorAll('i')).map((node) => node.textContent)).toEqual([
      'cd',
      'ef',
    ])
    expect(editor.querySelector('u')?.textContent).toBe('gh')
  })

  it('keeps markup-like content as text', () => {
    const editor = makeEditor()
    const payload = '<img src=x onerror=alert(1)><script>alert(1)</script>'
    renderRichText(editor, payload, [{ type: 'bold', start: 0, end: 10 }])

    expect(editor.textContent).toBe(payload)
    expect(editor.querySelector('img, script')).toBeNull()
  })

  it('adds the trailing line-break placeholder only when content ends in a newline', () => {
    const editor = makeEditor()
    renderRichText(editor, 'line\n', [])
    expect(editor.textContent).toBe('line\n\n')

    renderRichText(editor, 'line', [])
    expect(editor.textContent).toBe('line')
  })
})

describe('readRichText', () => {
  it('round-trips rendered content and marks', () => {
    const editor = makeEditor()
    const content = 'Title\n\nSome bold, italic and underlined text\n'
    const marks: NoteMark[] = [
      { type: 'bold', start: 12, end: 16 },
      { type: 'italic', start: 18, end: 24 },
      { type: 'underline', start: 29, end: 39 },
    ]
    renderRichText(editor, content, marks)

    expect(readRichText(editor)).toEqual({ content, marks })
  })

  it('reads strong, em, and inline styles', () => {
    const editor = makeEditor()
    setMarkup(editor, () => [
      el('strong', ['one']),
      el('em', ['two']),
      el('span', ['three'], 'font-weight: 700; text-decoration: underline'),
      el('b', [el('span', ['four'], 'font-weight: normal; font-style: italic')]),
    ])

    expect(readRichText(editor)).toEqual({
      content: 'onetwothreefour',
      marks: [
        { type: 'bold', start: 0, end: 3 },
        { type: 'bold', start: 6, end: 11 },
        { type: 'italic', start: 3, end: 6 },
        { type: 'italic', start: 11, end: 15 },
        { type: 'underline', start: 6, end: 11 },
      ],
    })
  })

  it('treats br and block elements as line breaks and ignores other nodes', () => {
    const editor = makeEditor()
    setMarkup(editor, (doc) => [
      doc.createTextNode('a'),
      el('br', []),
      doc.createTextNode('b'),
      el('div', ['c']),
      el('p', ['d']),
      doc.createComment('ignored'),
    ])

    expect(readRichText(editor).content).toBe('a\nb\nc\nd')
  })

  it('drops the trailing placeholder left by the browser', () => {
    const editor = makeEditor()
    setMarkup(editor, () => [el('br', [])])
    expect(readRichText(editor).content).toBe('')

    setMarkup(editor, (doc) => [doc.createTextNode('a\n'), el('br', [])])
    expect(readRichText(editor).content).toBe('a\n')
  })
})

describe('placeCaretAtEnd', () => {
  it('places the caret before the trailing line-break placeholder', () => {
    const editor = makeEditor()
    renderRichText(editor, 'line\n', [])
    placeCaretAtEnd(editor)

    const range = document.getSelection()?.getRangeAt(0)
    expect(range?.collapsed).toBe(true)
    expect(range?.startContainer).toBe(editor.lastChild)
    expect(range?.startOffset).toBe(0)
  })

  it('places the caret before a trailing br', () => {
    const editor = makeEditor()
    setMarkup(editor, (doc) => [doc.createTextNode('a'), el('br', [])])
    placeCaretAtEnd(editor)

    const range = document.getSelection()?.getRangeAt(0)
    expect(range?.startContainer).toBe(editor)
    expect(range?.startOffset).toBe(1)
  })

  it('places the caret after the last character otherwise', () => {
    const editor = makeEditor()
    renderRichText(editor, 'abc', [{ type: 'bold', start: 1, end: 3 }])
    placeCaretAtEnd(editor)

    const range = document.getSelection()?.getRangeAt(0)
    expect(range?.collapsed).toBe(true)
    expect(range?.endContainer).toBe(editor)
    expect(range?.endOffset).toBe(editor.childNodes.length)
  })
})
