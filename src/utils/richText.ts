import type { FormatMarkType, NoteMark, StyleMarkType } from '../types/note'
import { toLinkHref } from './linkUrl'
import { alignHeadingLines, buildSegments, normalizeMarks, type TextSegment } from './noteMarks'

export interface RichTextValue {
  content: string
  marks: NoteMark[]
}

const MARK_TAGS: Record<FormatMarkType, string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
}

/** Heading lines are blocks, so Chrome ends the heading when Enter is pressed at its end. */
export const HEADING_TAG = 'h3'

const TAG_MARKS: Record<string, StyleMarkType> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  H3: 'heading',
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'H3'])

/** Marks the anchors this module renders, so only they are read back as links. */
export const LINK_ATTRIBUTE = 'data-keep-notes-link'

function createLink(doc: Document, href: string, child: Node): HTMLAnchorElement {
  const anchor = doc.createElement('a')
  anchor.setAttribute('href', href)
  anchor.setAttribute('target', '_blank')
  anchor.setAttribute('rel', 'noopener noreferrer')
  anchor.setAttribute(LINK_ATTRIBUTE, '')
  anchor.appendChild(child)
  return anchor
}

/** Wraps text in the segment's format tags, then in a link when its href is safe. */
function renderInline(doc: Document, text: string, segment: TextSegment): Node {
  let node: Node = doc.createTextNode(text)
  for (const type of segment.types) {
    const wrapper = doc.createElement(MARK_TAGS[type])
    wrapper.appendChild(node)
    node = wrapper
  }
  const href = segment.href ? toLinkHref(segment.href) : null
  return href ? createLink(doc, href, node) : node
}

/**
 * Builds the editor DOM from plain text and marks using text nodes only, so
 * note content can never be interpreted as markup. Chrome keeps one extra
 * trailing newline as a caret placeholder when text ends in a line break, so
 * the render adds it and `readRichText` removes it again.
 */
export function renderRichText(container: HTMLElement, content: string, marks: readonly NoteMark[]): void {
  const doc = container.ownerDocument
  const fragment = doc.createDocumentFragment()
  // A heading block ends its own line, so the line break after it is not rendered.
  let heading: HTMLElement | null = null

  for (const segment of buildSegments(content, alignHeadingLines(content, marks))) {
    let text = segment.text
    if (heading && !segment.heading) {
      heading = null
      text = text.slice(1)
      if (!text) continue
    }
    const node = renderInline(doc, text, segment)
    if (segment.heading) {
      heading ??= fragment.appendChild(doc.createElement(HEADING_TAG))
      heading.appendChild(node)
    } else {
      fragment.appendChild(node)
    }
  }
  if (content.endsWith('\n')) fragment.appendChild(doc.createTextNode('\n'))

  container.replaceChildren(fragment)
}

function applyInlineStyle(element: HTMLElement, active: Set<StyleMarkType>): void {
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

function linkHref(element: HTMLElement): string | null {
  if (element.tagName !== 'A' || !element.hasAttribute(LINK_ATTRIBUTE)) return null
  return toLinkHref(element.getAttribute('href'))
}

interface DomPosition {
  node: Node
  offset: number
}

class RichTextReader {
  content = ''
  /** The content offset of the target position, once the walk has passed it. */
  caret: number | null = null
  /** Whether the target position is inside a heading. */
  caretInHeading = false
  /** Every text node read, with the content offset it starts at. */
  readonly texts: Array<{ node: Text; start: number }> = []
  private readonly marks: NoteMark[] = []
  private readonly open = new Map<StyleMarkType, NoteMark>()
  private openLink: NoteMark | null = null

  constructor(private readonly target: DomPosition | null = null) {}

  append(text: string, active: ReadonlySet<StyleMarkType>, href: string | null = null): void {
    if (!text) return
    if (active.has('heading') && text.includes('\n')) {
      // A heading marks the text of its lines, not the line breaks between them.
      const plain = new Set(active)
      plain.delete('heading')
      for (const part of text.split(/(\n)/)) this.append(part, part === '\n' ? plain : active, href)
      return
    }
    const start = this.content.length
    this.content += text
    if (href) this.markLink(href, start)
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

  /** Extends the open link over text appended from `start`, or opens a new one. */
  private markLink(href: string, start: number): void {
    if (this.openLink?.href === href && this.openLink.end === start) {
      this.openLink.end = this.content.length
    } else {
      this.openLink = { type: 'link', start, end: this.content.length, href }
      this.marks.push(this.openLink)
    }
  }

  breakLine(): void {
    if (this.content && !this.content.endsWith('\n')) this.append('\n', new Set())
  }

  private markCaret(offset: number, active: ReadonlySet<StyleMarkType>): void {
    this.caret = offset
    this.caretInHeading = active.has('heading')
  }

  walk(node: Node, active: ReadonlySet<StyleMarkType>, href: string | null = null): void {
    const children = Array.from(node.childNodes)
    for (const [index, child] of children.entries()) {
      if (this.target?.node === node && this.target.offset === index) {
        this.markCaret(this.content.length, active)
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child as Text
        if (this.target?.node === text) this.markCaret(this.content.length + this.target.offset, active)
        this.texts.push({ node: text, start: this.content.length })
        this.append(text.data, active, href)
      } else if (child instanceof HTMLElement) {
        this.walkElement(child, active, href)
      }
    }
    if (this.target?.node === node && this.target.offset >= children.length) {
      this.markCaret(this.content.length, active)
    }
  }

  private walkElement(element: HTMLElement, active: ReadonlySet<StyleMarkType>, href: string | null): void {
    if (element.tagName === 'BR') {
      this.append('\n', active, href)
      return
    }

    const next = new Set(active)
    const tagMark = TAG_MARKS[element.tagName]
    if (tagMark) next.add(tagMark)
    applyInlineStyle(element, next)

    const isBlock = BLOCK_TAGS.has(element.tagName)
    if (isBlock) this.breakLine()
    this.walk(element, next, linkHref(element) ?? href)
    if (isBlock) this.breakLine()
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

export interface RichTextCaret extends RichTextValue {
  /** The caret as an offset into `content`. */
  caret: number
  inHeading: boolean
  /** The caret as a DOM range, to restore it after a failed edit. */
  range: Range
}

type SelectionRoot = Node & { getSelection?: () => Selection | null }

/**
 * Reads the editor with the position of a collapsed caret inside it, or returns
 * null when there is no such caret. Chrome retargets `document.getSelection()`
 * to the shadow host, so the selection is read from the editor's own root.
 */
export function readRichTextCaret(container: HTMLElement): RichTextCaret | null {
  const root = container.getRootNode() as SelectionRoot
  const selection = root.getSelection?.() ?? container.ownerDocument.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null
  const range = selection.getRangeAt(0).cloneRange()
  if (!container.contains(range.startContainer)) return null

  const reader = new RichTextReader({ node: range.startContainer, offset: range.startOffset })
  reader.walk(container, new Set())
  if (reader.caret === null) return null
  const value = reader.result()
  return {
    ...value,
    caret: Math.min(reader.caret, value.content.length),
    inHeading: reader.caretInHeading,
    range,
  }
}

/**
 * Selects the content range [start, end). Both ends must fall on characters held
 * in text nodes; returns false otherwise, such as for the line break of a block.
 */
export function selectRichTextRange(container: HTMLElement, start: number, end: number): boolean {
  const reader = new RichTextReader()
  reader.walk(container, new Set())
  const first = reader.texts.find((text) => text.start <= start && start < text.start + text.node.length)
  const last = reader.texts.find((text) => text.start < end && end <= text.start + text.node.length)
  const selection = container.ownerDocument.getSelection()
  if (!first || !last || !selection) return false

  const range = container.ownerDocument.createRange()
  range.setStart(first.node, start - first.start)
  range.setEnd(last.node, end - last.start)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
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
