import { describe, expect, it } from 'vitest'
import { BULLET, lineAt, lineShortcut, parseListItem } from '../src/utils/lineFormat'

describe('lineAt', () => {
  it('finds the line around an offset', () => {
    const content = 'one\ntwo\n\nfour'
    expect(lineAt(content, 0)).toEqual({ start: 0, end: 3, text: 'one' })
    expect(lineAt(content, 3)).toEqual({ start: 0, end: 3, text: 'one' })
    expect(lineAt(content, 4)).toEqual({ start: 4, end: 7, text: 'two' })
    expect(lineAt(content, 8)).toEqual({ start: 8, end: 8, text: '' })
    expect(lineAt(content, 13)).toEqual({ start: 9, end: 13, text: 'four' })
  })

  it('handles empty content and a leading line break', () => {
    expect(lineAt('', 0)).toEqual({ start: 0, end: 0, text: '' })
    expect(lineAt('\nx', 0)).toEqual({ start: 0, end: 0, text: '' })
    expect(lineAt('\nx', 1)).toEqual({ start: 1, end: 2, text: 'x' })
  })
})

describe('lineShortcut', () => {
  it('turns "-", "1", and "#" into a bullet, a numbered item, and a heading', () => {
    expect(lineShortcut('-')).toEqual({ kind: 'list', marker: BULLET })
    expect(lineShortcut('1')).toEqual({ kind: 'list', marker: '1. ' })
    expect(lineShortcut('#')).toEqual({ kind: 'heading' })
  })

  it('ignores anything else', () => {
    for (const typed of ['', '--', '2', '10', '1.', '##', 'a-', ' -']) {
      expect(lineShortcut(typed)).toBeNull()
    }
  })
})

describe('parseListItem', () => {
  it('continues bullets with another bullet', () => {
    expect(parseListItem('• milk')).toEqual({ marker: '• ', next: '• ' })
    expect(parseListItem('• ')).toEqual({ marker: '• ', next: '• ' })
  })

  it('continues numbered items with the next number', () => {
    expect(parseListItem('1. a')).toEqual({ marker: '1. ', next: '2. ' })
    expect(parseListItem('9. ')).toEqual({ marker: '9. ', next: '10. ' })
    expect(parseListItem('007. x')).toEqual({ marker: '007. ', next: '8. ' })
  })

  it('rejects lines that only look similar', () => {
    for (const line of ['•x', '1.x', '1 x', 'a. x', ' • x', '- x', '1234567890. x', '']) {
      expect(parseListItem(line)).toBeNull()
    }
  })
})
