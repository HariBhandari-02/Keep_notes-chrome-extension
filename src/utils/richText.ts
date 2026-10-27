import type { NoteMark, NoteMarkType } from '../types/note'
import { buildSegments, normalizeMarks } from './noteMarks'

export interface RichTextValue {
  content: string
  marks: NoteMark[]
}

const MARK_TAGS: Record<NoteMarkType, string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
}

const TAG_MARKS: Record<string, NoteMarkType> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI'])

/**
 * Builds the editor DOM from plain text and marks using text nodes only, so
 * note content can never be interpreted as markup. Chrome keeps one extra
 * trailing newline as a caret placeholder when text ends in a line break, so
 * the render adds it and `readRichText` removes it again.
 */
export function renderRichText(container: HTMLElement, content: string, marks: readonly NoteMark[]): void {
  const doc = container.ownerDocument
  const fragment = doc.createDocumentFragment()

  for (const segment of buildSegments(content, marks)) {
    let node: Node = doc.createTextNode(segment.text)
    for (const type of segment.types) {
      const wrapper = doc.createElement(MARK_TAGS[type])
      wrapper.appendChild(node)
      node = wrapper
    }
    fragment.appendChild(node)
  }
  if (content.endsWith('\n')) fragment.appendChild(doc.createTextNode('\n'))

  container.replaceChildren(fragment)
}

function applyInlineStyle(element: HTMLElement, active: Set<NoteMarkType>): void {
  const { fontWeight, fontStyle, textDecoration, textDecorationLine } = element.style
  if (fontWeight) {
    const weight = Number(fontWeight)
    if (fontWeight === 'bold' || fontWeight === 'bolder' || weight >= 600) active.add('bold')
    else active.delete('bold')
  }
  if (fontStyle) {
    if (fontStyle === 'italic' || fontStyle === 'oblique') active.add('italic')
    else active.delete('italic')
  }
  if (`${textDecoration} ${textDecorationLine}`.includes('underline')) active.add('underline')
}

class RichTextReader {
  content = ''
  private readonly marks: NoteMark[] = []
  private readonly open = new Map<NoteMarkType, NoteMark>()

  append(text: string, active: ReadonlySet<NoteMarkType>): void {
    if (!text) return
    const start = this.content.length
    this.content += text
    for (const type of active) {
      const mark = this.open.get(type)
      if (mark?.end === start) {
        mark.end = this.content.length
      } else {
        const next = { type, start, end: this.content.length }
        this.open.set(type, next)
        this.marks.push(next)
      }
    }
  }

  breakLine(): void {
    if (this.content && !this.content.endsWith('\n')) this.append('\n', new Set())
  }

  walk(node: Node, active: ReadonlySet<NoteMarkType>): void {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        this.append((child as Text).data, active)
        continue
      }
      if (!(child instanceof HTMLElement)) continue
      if (child.tagName === 'BR') {
        this.append('\n', active)
        continue
      }

      const next = new Set(active)
      const tagMark = TAG_MARKS[child.tagName]
      if (tagMark) next.add(tagMark)
      applyInlineStyle(child, next)

      const isBlock = BLOCK_TAGS.has(child.tagName)
      if (isBlock) this.breakLine()
      this.walk(child, next)
      if (isBlock) this.breakLine()
    }
  }

  result(): RichTextValue {
    const content = this.content.endsWith('\n') ? this.content.slice(0, -1) : this.content
    return { content, marks: normalizeMarks(this.marks, content.length) }
  }
}

/** Reads plain text and formatting ranges back out of the editor DOM. */
export function readRichText(container: HTMLElement): RichTextValue {
  const reader = new RichTextReader()
  reader.walk(container, new Set())
  return reader.result()
}

/** Moves the caret to the end of the text, before Chrome's trailing line-break placeholder. */
export function placeCaretAtEnd(container: HTMLElement): void {
  const selection = container.ownerDocument.getSelection()
  if (!selection) return
  const range = container.ownerDocument.createRange()
  range.selectNodeContents(container)
  range.collapse(false)

  let last = container.lastChild
  while (last?.lastChild) last = last.lastChild
  if (last instanceof Text && last.data.endsWith('\n')) {
    range.setStart(last, last.data.length - 1)
    range.collapse(true)
  } else if (last instanceof HTMLElement && last.tagName === 'BR') {
    range.setStartBefore(last)
    range.collapse(true)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}
