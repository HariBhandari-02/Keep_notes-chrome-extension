/** What "-" becomes when a space is typed after it at the start of a line. */
export const BULLET = '• '

const LIST_MARKER = /^(?:• |(\d{1,9})\. )/

export interface Line {
  start: number
  /** Offset of the line break that ends the line, or the content length. */
  end: number
  text: string
}

export type LineShortcut = { kind: 'list'; marker: string } | { kind: 'heading' }

export interface ListItem {
  /** The marker the line starts with, such as "• " or "3. ". */
  marker: string
  /** The marker for the item after it. */
  next: string
}

/** The line of `content` that holds `offset`. */
export function lineAt(content: string, offset: number): Line {
  const start = offset > 0 ? content.lastIndexOf('\n', offset - 1) + 1 : 0
  const newline = content.indexOf('\n', offset)
  const end = newline === -1 ? content.length : newline
  return { start, end, text: content.slice(start, end) }
}

/** What typing a space turns `typed` into when it is all of the line before the caret. */
export function lineShortcut(typed: string): LineShortcut | null {
  if (typed === '-') return { kind: 'list', marker: BULLET }
  if (typed === '1') return { kind: 'list', marker: '1. ' }
  if (typed === '#') return { kind: 'heading' }
  return null
}

/** Lines that start with a bullet or "N. " are list items, which Enter continues. */
export function parseListItem(line: string): ListItem | null {
  const match = LIST_MARKER.exec(line)
  if (!match) return null
  const number = match[1]
  return { marker: match[0], next: number ? `${Number(number) + 1}. ` : BULLET }
}
