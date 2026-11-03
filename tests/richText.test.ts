// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { NoteMark } from '../src/types/note'
import {
  placeCaretAtEnd,
  readRichText,
  readRichTextCaret,
  renderRichText,
  selectRichTextRange,
} from '../src/utils/richText'

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

describe('links', () => {
  const URL_A = 'https://example.com/article'

  it('renders link marks as marked anchors and reads them back', () => {
    const editor = makeEditor()
    const marks: NoteMark[] = [
      { type: 'bold', start: 4, end: 6 },
      { type: 'link', start: 4, end: 9, href: URL_A },
    ]
    renderRichText(editor, 'See quote', marks)

    const anchors = Array.from(editor.querySelectorAll('a[data-keep-notes-link]'))
    expect(anchors.map((node) => node.textContent)).toEqual(['qu', 'ote'])
    expect(anchors.every((node) => node.getAttribute('href') === URL_A)).toBe(true)
    expect(anchors[0].getAttribute('rel')).toBe('noopener noreferrer')

    expect(readRichText(editor)).toEqual({ content: 'See quote', marks })
  })

  it('ignores anchors it did not render and unsafe hrefs', () => {
    const editor = makeEditor()
    const foreign = el('a', ['plain'])
    foreign.setAttribute('href', URL_A)
    const unsafe = el('a', ['bad'])
    unsafe.setAttribute('href', 'javascript' + ':void(0)')
    unsafe.setAttribute('data-keep-notes-link', '')
    setMarkup(editor, () => [foreign, unsafe])

    expect(readRichText(editor)).toEqual({ content: 'plainbad', marks: [] })
  })
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

function placeCaret(node: Node, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  document.getSelection()?.removeAllRanges()
  document.getSelection()?.addRange(range)
}

describe('headings', () => {
  it('render each heading line as a block without the line break after it', () => {
    const editor = makeEditor()
    const content = 'abc\nTitle\nmore\nEnd\n'
    const marks: NoteMark[] = [
      { type: 'bold', start: 4, end: 6 },
      { type: 'heading', start: 4, end: 9 },
      { type: 'heading', start: 15, end: 18 },
    ]
    renderRichText(editor, content, marks)

    expect(editor.innerHTML).toBe('abc\n<h3><b>Ti</b>tle</h3>more\n<h3>End</h3>\n')
    expect(readRichText(editor)).toEqual({ content, marks })
  })

  it('render consecutive heading lines as separate blocks', () => {
    const editor = makeEditor()
    renderRichText(editor, 'A\nB\n\nc', [{ type: 'heading', start: 0, end: 3 }])

    expect(Array.from(editor.querySelectorAll('h3')).map((node) => node.textContent)).toEqual(['A', 'B'])
    expect(readRichText(editor).content).toBe('A\nB\n\nc')
  })

  it('render a heading that ends mid-line across the whole line', () => {
    const editor = makeEditor()
    renderRichText(editor, 'Title rest\nx', [{ type: 'heading', start: 0, end: 5 }])

    expect(editor.querySelector('h3')?.textContent).toBe('Title rest')
    expect(readRichText(editor)).toEqual({
      content: 'Title rest\nx',
      marks: [{ type: 'heading', start: 0, end: 10 }],
    })
  })

  it('read the browser placeholder in an empty heading as an unmarked line break', () => {
    const editor = makeEditor()
    setMarkup(editor, (doc) => [doc.createTextNode('abc\n'), el('h3', ['\n']), doc.createTextNode('more')])

    expect(readRichText(editor)).toEqual({ content: 'abc\n\nmore', marks: [] })
  })
})

describe('readRichTextCaret', () => {
  it('reports the caret as a content offset', () => {
    const editor = makeEditor()
    renderRichText(editor, 'abc\nTitle\nmore', [{ type: 'heading', start: 4, end: 9 }])

    placeCaret(editor.querySelector('h3')!.firstChild!, 2)
    expect(readRichTextCaret(editor)).toMatchObject({ content: 'abc\nTitle\nmore', caret: 6, inHeading: true })

    placeCaret(editor.lastChild!, 1)
    expect(readRichTextCaret(editor)).toMatchObject({ caret: 11, inHeading: false })
  })

  it('counts element positions, block breaks, and the end of the editor', () => {
    const editor = makeEditor()
    const line = el('div', [el('br', [])])
    setMarkup(editor, (doc) => [doc.createTextNode('abc'), line])

    placeCaret(line, 0)
    expect(readRichTextCaret(editor)?.caret).toBe(4)

    placeCaret(editor, 2)
    expect(readRichTextCaret(editor)?.caret).toBe(4)

    placeCaret(editor, 1)
    expect(readRichTextCaret(editor)?.caret).toBe(3)
  })

  it('returns null without a collapsed caret inside the editor', () => {
    const editor = makeEditor()
    renderRichText(editor, 'abc', [])

    const range = document.createRange()
    range.setStart(editor.firstChild!, 0)
    range.setEnd(editor.firstChild!, 2)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    expect(readRichTextCaret(editor)).toBeNull()

    placeCaret(document.body, 0)
    expect(readRichTextCaret(editor)).toBeNull()

    document.getSelection()?.removeAllRanges()
    expect(readRichTextCaret(editor)).toBeNull()
  })
})

describe('selectRichTextRange', () => {
  it('selects content offsets across text nodes and blocks', () => {
    const editor = makeEditor()
    renderRichText(editor, 'ab\nTitle\nmore', [
      { type: 'bold', start: 4, end: 6 },
      { type: 'heading', start: 3, end: 8 },
    ])

    expect(selectRichTextRange(editor, 4, 11)).toBe(true)
    expect(document.getSelection()?.toString()).toBe('itlemo')

    expect(selectRichTextRange(editor, 0, 2)).toBe(true)
    expect(document.getSelection()?.toString()).toBe('ab')
  })

  it('refuses offsets that are not on text', () => {
    const editor = makeEditor()
    setMarkup(editor, (doc) => [doc.createTextNode('a'), el('br', []), doc.createTextNode('b')])

    expect(selectRichTextRange(editor, 1, 3)).toBe(false)
    expect(selectRichTextRange(editor, 0, 9)).toBe(false)
  })
})
